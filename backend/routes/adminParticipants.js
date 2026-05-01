const router = require("express").Router();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const EventRegistration = require("../models/eventRegistration");
const Event = require("../models/event");
const Notification = require("../models/notification"); // added
const User = require("../models/users"); // added
const { adminAuthMiddleware } = require("../Middleware/adminAuthMiddleware");

// --- PATCH: transporter setup with SMTP_* preferred, fallback to EMAIL_* and Ethereal test ---
let transporter;
let DEFAULT_FROM = '"HeronFusion Events" <no-reply@heronfusion.art>';

(async () => {
  try {
    // prefer explicit SMTP vars but allow legacy EMAIL_USER / EMAIL_PASS fallback
    const host = process.env.SMTP_HOST || null;
    const user = process.env.SMTP_USER || process.env.EMAIL_USER || null;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || null;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : (process.env.SMTP_SECURE === 'true' ? 465 : 587);
    const secure = (process.env.SMTP_SECURE === 'true') || port === 465;

    if (host && user && pass) {
      transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: !!secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false' }
      });
      await transporter.verify();
      DEFAULT_FROM = process.env.SMTP_FROM || `${user.includes('@') ? `"HeronFusion Events" <${user}>` : '"HeronFusion Events" <no-reply@heronfusion.art>'}`;
      console.log('✅ SMTP transporter ready', { host, user });
    } else {
      // no SMTP credentials: use Ethereal (development/test only)
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      DEFAULT_FROM = `"HeronFusion Events" <${testAccount.user}>`;
      console.log('⚠️ No SMTP config found - using Ethereal test account. Preview URLs will be available in logs.');
    }
  } catch (err) {
    console.error('❌ Failed to create mail transporter:', err);
    transporter = null;
  }
})();

// use admin auth for routes
router.use(adminAuthMiddleware);

// Get all participants with filters
router.get("/participants", async (req, res) => {
  try {
    console.log('📊 Fetching all registrations for admin');

    let registrationQuery = {};
    
    // If admin is organization-scoped (not superadmin), filter by organization
    if (req.user?.adminOrganization && req.user.adminOrganization !== 'admin@all') {
      const orgEventIds = await Event.find({ organization: req.user.adminOrganization })
        .select('_id')
        .lean()
        .then(events => events.map(e => e._id));
      
      if (orgEventIds.length > 0) {
        registrationQuery.eventId = { $in: orgEventIds };
      } else {
        // No events for this organization, return empty
        return res.json({ success: true, count: 0, data: [] });
      }
    }

    const registrations = await EventRegistration.find(registrationQuery)
      .populate({
        path: 'eventId',
        // include registrationForm schema and other useful event fields
        select: 'title organization date location registrationForm eventType image maxParticipants'
      })
      .populate('userId', 'name email profilePic') // include user basic info
      .sort({ registrationDate: -1 })
      .lean();

    console.log(`Found ${registrations.length} registrations`);

    // Preserve the full registration doc as `raw` and attach eventForm if present
    const participants = registrations.map(reg => {
      const ev = reg.eventId || {};
      return {
        id: String(reg._id),
        _id: reg._id,
        raw: reg,                          // full original document for frontend lookup
        user: reg.userId || null,
        // convenience top-level fields (backwards-compatible)
        name: reg.name || reg.userId?.name || '',
        email: reg.email || reg.userId?.email || '',
        studentId: reg.studentId || '',
        phone: reg.phone || '',
        yearLevel: reg.yearLevel || '',
        course: reg.course || '',
        organization: reg.organization || ev.organization || '',
        eventId: ev._id ? String(ev._id) : (reg.eventId ? String(reg.eventId) : ''),
        eventName: ev.title || reg.eventName || '',
        eventDate: ev.date || reg.eventDate || null,
        eventLocation: ev.location || reg.eventLocation || '',
        status: reg.status || 'pending',
        registrationDate: reg.registrationDate || reg.createdAt || null,
        // pass canonical event form schema if populated
        eventForm: Array.isArray(ev.registrationForm) ? ev.registrationForm : (reg.eventForm || []),
        // keep other custom fields so existing frontend code still works
        registrationType: reg.registrationType || ev.eventType || '',
        uploadedFiles: reg.uploadedFiles || [],
        auditionPiece: reg.auditionPiece || '',
        experienceYears: reg.experienceYears || '',
        specialSkills: reg.specialSkills || '',
        motivation: reg.motivation || '',
        availability: reg.availability || '',
        reasonForWatching: reg.reasonForWatching || '',
        attendedBefore: reg.attendedBefore || '',
        companion: reg.companion || '',
        accessibilityNeeds: reg.accessibilityNeeds || ''
      };
    });

    console.log('Transformed first registration (preview):', participants[0]);
    return res.json({ success: true, count: participants.length, data: participants });
  } catch (err) {
    console.error('❌ Error fetching registrations:', err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations",
      error: err.message
    });
  }
});

// Get participant statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await EventRegistration.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }},
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }},
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }},
          waitlisted: { $sum: { $cond: [{ $eq: ["$status", "waitlisted"] }, 1, 0] }}
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0
      }
    });
  } catch (err) {
    console.error('❌ Error fetching stats:', err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch statistics"
    });
  }
});

// Update participant status
router.patch("/participants/:id/status", async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'waitlisted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value", validStatuses });
    }

    // Find and update registration
    const updated = await EventRegistration.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNotes,
        lastModified: new Date(),
        modifiedBy: req.user.id
      },
      { new: true }
    ).populate('eventId');

    if (!updated) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    // Send notification if approved
    if (status === 'approved') {
      const notifMessage = `Congratulations! Your registration for "${updated.eventId.title}" has been approved.`;
      const actionUrl = process.env.WEB_APP_URL
        ? `${process.env.WEB_APP_URL.replace(/\/$/, '')}/events/${updated.eventId._id}`
        : null;

      await Notification.create({
        userId: updated.userId,
        senderId: req.user.id,
        type: 'event_invite',
        message: notifMessage,
        actionUrl,
        postImage: updated.eventId?.image || null,
        data: {
          eventId: updated.eventId._id,
          registrationId: updated._id,
          adminNotes: adminNotes || ''
        },
        priority: 'high',
        category: 'social'
      });

      // Optionally emit socket event
      const io = req.app.get('io');
      if (io) {
        io.emit('notification:new', {
          userId: updated.userId,
          message: notifMessage
        });
      }

      // Send confirmation email (approval flow)
      const user = await User.findById(updated.userId);
      const event = updated.eventId;
      const emailPayload = buildConfirmationEmail({ registration: updated, event, user, type: 'approval' });

      const mailOptions = {
        from: DEFAULT_FROM,
        to: user.email,
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text,
        attachments: emailPayload.attachments
      };

      // capture email send result to return to client
      let emailSent = false;
      let emailPreview = null;
      let emailError = null;

      if (!transporter) {
        console.error('Mail transporter not configured');
        emailError = 'Mail transporter not configured';
      } else {
        try {
          const info = await transporter.sendMail(mailOptions);
          const preview = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
          if (preview) console.log('📝 Email preview URL:', preview);
          emailSent = true;
          emailPreview = preview;
        } catch (mailErr) {
          console.error('Failed sending approval email:', mailErr);
          emailError = mailErr.message || String(mailErr);
        }
      }
    }

    // include email send flags when approving so frontend can show toasts
    return res.json({
      success: true,
      message: "Status updated successfully",
      data: updated,
      emailSent: typeof emailSent !== 'undefined' ? emailSent : false,
      emailPreview: typeof emailPreview !== 'undefined' ? emailPreview : null,
      emailError: typeof emailError !== 'undefined' ? emailError : null
    });
 
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});
 
router.post("/participants/:id/send-confirmation", async (req, res) => {
  try {
    const registration = await EventRegistration.findById(req.params.id).populate('eventId').populate('userId');
    if (!registration) return res.status(404).json({ success: false, message: "Registration not found" });

    const event = registration.eventId;
    const user = registration.userId;

    // accept adminNotes from the client so admin can personalise the email
    const adminNotesFromClient = (req.body && req.body.adminNotes) ? String(req.body.adminNotes).trim() : (registration.adminNotes || '');

    const emailPayload = buildConfirmationEmail({ registration, event, user, type: 'confirmation', adminNotes: adminNotesFromClient });
    const mailOptions = {
      from: DEFAULT_FROM,
      to: registration.email || user?.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
      attachments: emailPayload.attachments
    };

    if (!transporter) {
      console.error('Attempt to send confirmation but mail transporter is not configured');
      return res.status(500).json({
        success: false,
        message: 'Mail transporter not configured. Set SMTP env vars or wait for test transporter init.'
      });
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      const preview = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
      if (preview) console.log('📝 Email preview URL:', preview);
      return res.json({ success: true, message: "Confirmation email sent", preview });
    } catch (mailErr) {
      console.error('Send confirmation email error:', mailErr);
      return res.status(500).json({ success: false, message: "Failed to send confirmation email", error: mailErr.message });
    }

  } catch (err) {
    console.error('Send confirmation email error:', err);
    res.status(500).json({ success: false, message: "Failed to send confirmation email" });
  }
});
 
// --- NEW: email template builder (detailed + printable slip + sms text) ---
function buildConfirmationEmail({ registration, event, user, type = 'confirmation', adminNotes = '' }) {
  const eventDate = event?.date ? new Date(event.date) : null;
  const formattedDate = eventDate ? eventDate.toLocaleDateString() : 'TBA';
  const formattedTime = eventDate ? eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBA';
  const recipientName = registration?.name || user?.name || 'Participant';
  const bandOrOrg = registration?.organization || event?.organization || '';
  const auditionPiece = registration?.auditionPiece || registration?.auditionSong || registration?.audition || '';

  const subject = type === 'approval'
    ? `✅ ${event.title} — Registration Approved`
    : `🎫 ${event.title} – Registration Confirmed!`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#222; line-height:1.4">
      <h2 style="margin-bottom:6px">${type === 'approval' ? 'Congratulations!' : 'Registration Confirmed'}</h2>
      <p>Hi <strong>${recipientName}</strong>,</p>

     ${adminNotes ? `<p style="background:#fff8e1;padding:10px;border-left:4px solid #ffd54f;"><strong>Message from organizer:</strong><br/>${adminNotes.replace(/\n/g,'<br/>')}</p>` : ''}

      <p>Your ${type === 'approval' ? 'registration has been <strong>approved</strong>' : 'registration is confirmed'} for:</p>

      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse; margin:10px 0; background:#f9f9f9; border:1px solid #eee;">
        <tr><td style="font-weight:600">Event</td><td>${event.title}</td></tr>
        <tr><td style="font-weight:600">Organizer</td><td>${event.organization || bandOrOrg}</td></tr>
        <tr><td style="font-weight:600">Date</td><td>${formattedDate}</td></tr>
        <tr><td style="font-weight:600">Time</td><td>${formattedTime}</td></tr>
        <tr><td style="font-weight:600">Venue</td><td>${event.location || 'TBA'}</td></tr>
        ${auditionPiece ? `<tr><td style="font-weight:600">Audition Piece</td><td>${auditionPiece}</td></tr>` : ''}
        <tr><td style="font-weight:600">Registrant</td><td>${recipientName} (${registration.email || user?.email || 'N/A'})</td></tr>
        <tr><td style="font-weight:600">Student ID</td><td>${registration.studentId || 'N/A'}</td></tr>
      </table>

      <p><strong>Important:</strong> Please arrive early for check-in and preparation. Follow the event instructions for any required items or special preparations.</p>

      <p>If you need to contact us: <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@yourdomain.com'}">${process.env.SUPPORT_EMAIL || 'support@yourdomain.com'}</a></p>

      <hr style="border:none; border-top:1px solid #eee; margin:12px 0" />

      <p style="font-size:13px; color:#555">Printable confirmation is attached. Keep it for entry and verification.</p>
    </div>
  `;

  const text = `${event.title} — ${type === 'approval' ? 'Approved' : 'Confirmed'}\n\n` +
    `Hi ${recipientName},\n\n` +
    (adminNotes ? `Message from organizer:\n${adminNotes}\n\n` : '') +
    `Event: ${event.title}\n` +
    `Date: ${formattedDate}\n` +
    `Time: ${formattedTime}\n` +
    `Venue: ${event.location || 'TBA'}\n\n` +
    `Status: ${type === 'approval' ? 'APPROVED' : 'CONFIRMED'}\n\n` +
    `Please arrive early for check-in and preparation. Questions: ${process.env.SUPPORT_EMAIL || 'support@yourdomain.com'}`;

  // printable slip HTML (simple, can be printed from email client)
  const printableHtml = `
    <html>
    <head><meta charset="utf-8"><title>Confirmation Slip</title></head>
    <body style="font-family:Arial,Helvetica,sans-serif;padding:20px;">
      <h2 style="text-align:center">${event.title} — Confirmation Slip</h2>
      <p><strong>Organizer:</strong> ${event.organization || 'N/A'}</p>
      <p><strong>Registrant:</strong> ${recipientName}</p>
      <p><strong>Email:</strong> ${registration.email || user?.email || 'N/A'}</p>
      <p><strong>Student ID:</strong> ${registration.studentId || 'N/A'}</p>
      <p><strong>Date & Time:</strong> ${formattedDate} ${formattedTime}</p>
      <p><strong>Venue:</strong> ${event.location || 'TBA'}</p>
      <p><strong>Event Notes:</strong> ${auditionPiece || '—'}</p>
      <p style="margin-top:18px">✅ <strong>Registration Status:</strong> ${type === 'approval' ? 'APPROVED' : 'CONFIRMED'}</p>
      <p style="margin-top:24px">Call Time: ${event.callTime || 'Arrive early for preparation'}</p>
      <br/>
      <p>Verified by: ____________________________</p>
      <p>Date: ____________________________</p>
    </body>
    </html>
  `;

  return {
    subject,
    html,
    text,
    attachments: [
      {
        filename: `${event.title.replace(/\s+/g,'_').slice(0,40)}_confirmation.html`,
        content: printableHtml,
        contentType: 'text/html'
      }
    ]
  };
}

module.exports = router;