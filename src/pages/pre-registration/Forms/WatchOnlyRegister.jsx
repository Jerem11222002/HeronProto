import React, { useState, useEffect } from 'react';
import RegistrationConfirmation from '../../../components/registration/RegistrationConfirmation';
import DynamicRegistrationForm from './DynamicRegistrationForm';
import { toast } from 'react-toastify';
import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function WatchOnlyRegister({ event, user }) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [registrationData, setRegistrationData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [resolvedUser, setResolvedUser] = useState(user || null);
  useEffect(() => {
    let mounted = true;
    if (mounted && resolvedUser && (resolvedUser.studentId || resolvedUser.studentID || resolvedUser.student_id)) {
      return;
    }
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${baseURL}/api/users/me`, { headers });
        if (mounted && res?.data) setResolvedUser(res.data);
      } catch (err) {
        try {
          if (user?.id || user?._id) {
            const id = user.id || user._id;
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res2 = await axios.get(`${baseURL}/api/users/${id}`, { headers });
            if (mounted && res2?.data) setResolvedUser(res2.data);
          }
        } catch (e) {
          console.debug('[WatchOnlyRegister] could not fetch full user profile', e?.message || e);
        }
      }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [user, resolvedUser]);

  // Use admin-created registrationForm schema
  const schema = Array.isArray(event.registrationForm) && event.registrationForm.length > 0
    ? event.registrationForm
    : [];

  console.debug('[WatchOnlyRegister] using schema length:', schema.length, schema);

  // Prefill initial values from user context for only the fields present in the schema
  const initialValues = {};
  schema.forEach(field => {
    if (field.key === 'name') initialValues.name = resolvedUser?.name || resolvedUser?.fullName || '';
    if (field.key === 'email') initialValues.email = resolvedUser?.email || resolvedUser?.mail || '';
    if (field.key === 'studentId') {
      initialValues.studentId = resolvedUser?.studentId
        || resolvedUser?.studentID
        || resolvedUser?.student_id
        || '';
    }
  });

  // Optionally: mark basic info fields as read-only in the schema
  const patchedSchema = schema.map(field => {
    if (['name', 'email', 'studentId'].includes(field.key)) {
      return { ...field, readOnly: true }; // Add a custom prop
    }
    return field;
  });

  // Ensure consent checkbox exists (required)
  const consentKey = 'consent.agreeToUse';
  const hasConsent = patchedSchema.some(f => f.key === consentKey);
  if (!hasConsent) {
    patchedSchema.push({
      key: consentKey,
      label: 'I agree to allow my information to be used for event registration and communication.',
      type: 'checkbox',
      required: true,
      hint: 'By checking this box you consent to use of your information for registration and event-related communication.'
    });
  }

  // Ensure initialValues contains consent default
  if (!initialValues.consent) initialValues.consent = { agreeToUse: false };
  if (initialValues.consent && initialValues.consent.agreeToUse === undefined) initialValues.consent.agreeToUse = false;

  // If no schema available, show a friendly message instead of an empty form
  if (!schema.length) {
    return (
      <div className="pre-register-form watchonly-form">
        <h3>No registration form available</h3>
        <p>This event currently does not have a registration form set up by the organizer. Please contact the event organizer for assistance.</p>
      </div>
    );
  }

  const submitHandler = async (values, isFormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      // Debug log
      console.log('[WatchOnlyRegister] Submitting registration:', {
        eventId: event._id,
        userId: user?.id || user?._id || resolvedUser?.id || resolvedUser?._id,
        isFormData
      });

      if (isFormData) {
        // values is a FormData instance created by DynamicRegistrationForm
        const fd = values;
        fd.append('eventId', event._id);
        // prefer user.id || user._id || resolvedUser._id
        const uid = user?.id || user?._id || resolvedUser?.id || resolvedUser?._id;
        if (uid) fd.append('userId', uid);
        // do NOT set Content-Type so browser sets multipart boundary
        const res = await axios.post(`${baseURL}/api/event-registrations/register`, fd, { headers: { ...authHeaders } });
        console.log('[WatchOnlyRegister] Registration success:', res.data);
        setRegistrationData({
          registrationId: res.data.registrationId || '',
          userName: fd.get('name') || '',
          eventName: event.title
        });
      } else {
        const payload = { ...(values || {}) , eventId: event._id, userId: user?.id || user?._id || resolvedUser?.id || resolvedUser?._id };
        console.log('[WatchOnlyRegister] Sending JSON payload:', payload);
        const res = await axios.post(`${baseURL}/api/event-registrations/register`, payload, { headers: { 'Content-Type': 'application/json', ...authHeaders } });
        console.log('[WatchOnlyRegister] Registration success:', res.data);
        setRegistrationData({
          registrationId: res.data.registrationId || '',
          userName: values.name || '',
          eventName: event.title
        });
      }
      setShowConfirmation(true);
    } catch (err) {
      console.error('[WatchOnlyRegister] Registration failed:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      const serverMessage = err.response?.data?.message;
      const serverError = err.response?.data?.error;
      const errorMessage = serverMessage || serverError || err.message || 'Failed to submit registration';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showConfirmation) {
    return (
      <RegistrationConfirmation
        type="audience"
        eventName={registrationData?.eventName}
        registrationId={registrationData?.registrationId}
        userName={registrationData?.userName}
      />
    );
  }

  return (
    <DynamicRegistrationForm
      schema={patchedSchema}
      initialValues={initialValues}
      onSubmit={submitHandler}
      submitLabel="Register Now"
      className="pre-register-form watchonly-form"
    />
  );
}