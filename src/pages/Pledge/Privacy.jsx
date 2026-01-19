import React from "react";
import "./terms.scss";

const Privacy = () => (
  <div className="terms-bg">
    <div className="terms-page">
      <h1>Privacy Policy</h1>
      <p>
        Heron Fusion ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
      </p>
      
      <h2>1. Information We Collect</h2>
      <p>
        We collect information you provide directly to us, such as when you create an account, complete your profile, register for events, or contact our support team. This may include your name, email address, phone number, educational institution, and profile information.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To create and manage your account</li>
        <li>To provide and improve our services</li>
        <li>To send you event notifications and updates</li>
        <li>To personalize your experience with tailored recommendations</li>
        <li>To comply with legal obligations</li>
        <li>To monitor and analyze platform usage and trends</li>
      </ul>

      <h2>3. Information Sharing</h2>
      <p>
        We do not sell your personal information to third parties. We may share your information only in the following circumstances:
      </p>
      <ul>
        <li>With event organizers (your name and registration information) when you register for an event</li>
        <li>With service providers who assist us in operating our platform</li>
        <li>When required by law or to protect our legal rights</li>
        <li>With your consent for specific purposes</li>
      </ul>

      <h2>4. Data Security</h2>
      <p>
        We implement industry-standard security measures to protect your information from unauthorized access, alteration, and destruction. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>5. Your Privacy Rights</h2>
      <p>
        You have the right to access, update, or delete your personal information at any time through your account settings. You may also contact us at{" "}
        <a href="mailto:privacy@heronfusion.com">privacy@heronfusion.com</a> to exercise these rights.
      </p>

      <h2>6. Cookies and Tracking</h2>
      <p>
        We use cookies and similar tracking technologies to enhance your experience. You can control cookie preferences through your browser settings, but disabling cookies may limit platform functionality.
      </p>

      <h2>7. Children's Privacy</h2>
      <p>
        Heron Fusion is designed for educational institutions and is not intended for children under the age of 13. We do not knowingly collect information from children under 13.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the updated policy on our platform. Your continued use of Heron Fusion constitutes your acceptance of the updated Privacy Policy.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        If you have questions or concerns about our Privacy Policy, please contact us at{" "}
        <a href="mailto:privacy@heronfusion.com">privacy@heronfusion.com</a>.
      </p>

      <p>
        Last Updated: {new Date().getFullYear()}
      </p>
    </div>
  </div>
);

export default Privacy;
