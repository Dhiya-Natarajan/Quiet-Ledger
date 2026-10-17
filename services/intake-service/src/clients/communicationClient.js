const axios = require('axios');

const COMMUNICATION_URL = process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:4003';
const TIMEOUT_MS = 3500;

/**
 * Low-level notification dispatcher
 */
async function sendNotification(payload) {
  try {
    const res = await axios.post(`${COMMUNICATION_URL}/notifications`, payload, {
      timeout: TIMEOUT_MS,
    });
    return res.data;
  } catch (err) {
    console.warn(`[fail-open] Communication Service /notifications failed (${err.message}). Proceeding.`);
    return null;
  }
}

/**
 * Low-level email dispatcher
 */
async function sendEmail(payload) {
  try {
    const res = await axios.post(`${COMMUNICATION_URL}/messages/email`, payload, {
      timeout: TIMEOUT_MS,
    });
    return res.data;
  } catch (err) {
    console.warn(`[fail-open] Communication Service /messages/email failed (${err.message}). Proceeding.`);
    return null;
  }
}

/**
 * Low-level SMS dispatcher
 */
async function sendSms(payload) {
  try {
    const res = await axios.post(`${COMMUNICATION_URL}/messages/sms`, payload, {
      timeout: TIMEOUT_MS,
    });
    return res.data;
  } catch (err) {
    console.warn(`[fail-open] Communication Service /messages/sms failed (${err.message}). Proceeding.`);
    return null;
  }
}

/**
 * Triggered on new report creation (CaseAssigned event)
 * Parties addressed by tracking token if anonymous
 */
async function notifyReportCreated({ report, reporter, entity }) {
  try {
    const reportTitle = report.title || report.description?.slice(0, 50) || 'Untitled Report';
    const reporterTokenLabel = report.is_anonymous
      ? `Token #${report.tracking_token ? report.tracking_token.slice(0, 8) : 'ANON'}`
      : (reporter?.name || `User #${report.reporter_id}`);

    // 1. Alert Handler (Organisation or Police Station)
    const handlerTargetUserId = report.type === 'internal'
      ? `org-${report.org_id}`
      : `station-${report.station_id}`;

    await sendNotification({
      userId: handlerTargetUserId,
      type: report.type === 'internal' ? 'WORKPLACE_COMPLAINT' : 'POLICE_INCIDENT',
      title: `Case Assigned: ${reportTitle}`,
      message: `A new ${report.type} case has been routed to your queue. Filed by: ${reporterTokenLabel}.`,
      link: `/reports/${report.id}`,
    });

    // If organisation or police station has a contact email configured
    if (entity?.contact_email) {
      sendEmail({
        to: entity.contact_email,
        subject: `[QuietLedger Alert] New ${report.type} case assigned (Report #${report.id})`,
        body: `A new case has been routed to your queue.\n\nTitle: ${reportTitle}\nDetails: ${report.description}\nReporter: ${reporterTokenLabel}\nAccess the secure portal: http://localhost:5173`,
      }).catch((e) => console.warn('[fail-open] Entity email dispatch error:', e.message));
    }

    // 2. Receipt for Citizen
    if (report.reporter_id) {
      await sendNotification({
        userId: String(report.reporter_id),
        type: 'REPORT_SUBMITTED',
        title: `Report #${report.id} Submitted`,
        message: `Your report "${reportTitle}" has been securely recorded. Tracking Token: ${report.tracking_token || 'N/A'}`,
        link: `/reports/${report.id}`,
      });

      if (!report.is_anonymous && reporter?.email) {
        sendEmail({
          to: reporter.email,
          subject: `[QuietLedger] Confirmation: Report #${report.id} Received`,
          body: `Dear ${reporter.name || 'Citizen'},\n\nYour report "${reportTitle}" has been received and routed for review.\nTracking Token: ${report.tracking_token || 'N/A'}\n\nThank you for speaking up.`,
        }).catch((e) => console.warn('[fail-open] Citizen email dispatch error:', e.message));
      }

      if (!report.is_anonymous && reporter?.phone_number) {
        sendSms({
          to: reporter.phone_number,
          message: `QuietLedger: Report #${report.id} confirmed. Status: SUBMITTED. View at http://localhost:5173`,
        }).catch((e) => console.warn('[fail-open] Citizen SMS dispatch error:', e.message));
      }
    }
  } catch (err) {
    console.warn(`[fail-open] notifyReportCreated error: ${err.message}`);
  }
}

/**
 * Triggered when a report transitions status
 */
async function notifyStatusUpdated({ report, oldStatus, newStatus, reporter }) {
  try {
    const reportTitle = report.title || `Report #${report.id}`;

    // 1. Notify the reporter
    if (report.reporter_id) {
      await sendNotification({
        userId: String(report.reporter_id),
        type: 'STATUS_CHANGED',
        title: `Status Updated: ${reportTitle}`,
        message: `Your report status changed from "${oldStatus}" to "${newStatus.toUpperCase()}".`,
        link: `/reports/${report.id}`,
      });

      if (reporter?.email) {
        sendEmail({
          to: reporter.email,
          subject: `[QuietLedger] Status Update: Report #${report.id} is now ${newStatus.toUpperCase()}`,
          body: `Your case status has been updated to "${newStatus}".\nLog in to the portal to view details and chat with handlers.`,
        }).catch((e) => console.warn('[fail-open] Status email dispatch error:', e.message));
      }
    }

    // 2. Also notify the handler queue so officers/handlers see the status update
    const handlerTargetUserId = report.type === 'internal'
      ? `org-${report.org_id}`
      : `station-${report.station_id}`;

    if (report.org_id || report.station_id) {
      await sendNotification({
        userId: handlerTargetUserId,
        type: 'STATUS_CHANGED',
        title: `Case Status Updated: ${reportTitle}`,
        message: `Report #${report.id} transitioned from "${oldStatus}" to "${newStatus.toUpperCase()}".`,
        link: `/reports/${report.id}`,
      });
    }
  } catch (err) {
    console.warn(`[fail-open] notifyStatusUpdated error: ${err.message}`);
  }
}

/**
 * Two-way confidential chat messaging: parties addressed by token if anonymous
 */
async function notifyMessageSent({ report, message, senderId, senderName }) {
  try {
    const isReporterSender = String(senderId) === String(report.reporter_id);

    // Determine recipient
    const recipientUserId = isReporterSender
      ? (report.type === 'internal' ? `org-${report.org_id}` : `station-${report.station_id}`)
      : String(report.reporter_id);

    // Strict anonymity guarantee: If reporter is sender and anonymous, show token
    const displaySender = isReporterSender && report.is_anonymous
      ? `Reporter [Token #${report.tracking_token ? report.tracking_token.slice(0, 8) : 'ANON'}]`
      : senderName;

    await sendNotification({
      userId: recipientUserId,
      type: 'CASE_MESSAGE',
      title: `New Message on Report #${report.id}`,
      message: `${displaySender}: "${message.body.slice(0, 80)}${message.body.length > 80 ? '...' : ''}"`,
      link: `/reports/${report.id}`,
    });
  } catch (err) {
    console.warn(`[fail-open] notifyMessageSent error: ${err.message}`);
  }
}

/**
 * Emergency break-glass disclosure alert
 */
async function notifyBreakGlass({ report, adminUser, reporterUser, reason, targetDesc, targetContactEmail }) {
  try {
    const citizenInfo = reporterUser
      ? `${reporterUser.name} (${reporterUser.email}${reporterUser.phone_number ? ', Phone: ' + reporterUser.phone_number : ''})`
      : `Citizen #${report.reporter_id}`;

    const adminName = adminUser?.name || 'Platform Admin';

    // 1. Alert Platform Admins
    await sendNotification({
      userId: 'platform-admins',
      type: 'BREAK_GLASS_ALERT',
      title: `🚨 BREAK-GLASS EXECUTED: Report #${report.id}`,
      message: `Admin ${adminName} unmasked identity for Report #${report.id}. Citizen: ${citizenInfo}. Escalated to: ${targetDesc}. Reason: "${reason}"`,
      link: `/reports/admin/audit-logs`,
    });

    // 2. Alert Target Handler (Organisation or Police Station) with citizen details
    const handlerPayload = {
      type: 'BREAK_GLASS_ALERT',
      title: `🚨 EMERGENCY CITIZEN UNMASKED: Report #${report.id}`,
      message: `Break-Glass unsealed citizen identity for Report #${report.id}! Citizen: ${citizenInfo}. Reason: "${reason}". Check your case queue for full details.`,
      link: `/dashboard`,
    };

    if (report.org_id) {
      await sendNotification({ ...handlerPayload, userId: `org-${report.org_id}` });
    } else if (report.station_id) {
      await sendNotification({ ...handlerPayload, userId: `station-${report.station_id}` });
    }

    // 3. Dispatch official Emergency Disclosure Email to organisation or police station contact email
    if (targetContactEmail) {
      await sendEmail({
        to: targetContactEmail,
        subject: `[EMERGENCY BREAK-GLASS] Unmasked Citizen Identity: Report #${report.id}`,
        body: `EMERGENCY BREAK-GLASS IDENTITY DISCLOSURE\n\nReport #${report.id}: "${report.title || 'Untitled'}"\nTarget: ${targetDesc}\n\nUNMASKED CITIZEN DETAILS:\n- Full Name: ${reporterUser?.name || 'N/A'}\n- Email: ${reporterUser?.email || 'N/A'}\n- Phone: ${reporterUser?.phone_number || 'Not provided'}\n- Account Role: ${(reporterUser?.role || 'citizen').toUpperCase()}\n\nAUTHORIZATION JUSTIFICATION:\n- Authorized By: ${adminName}\n- Reason: "${reason}"\n- Timestamp: ${new Date().toLocaleString()}\n\nAccess the dashboard to view the full unmasked case history: http://localhost:5173/dashboard\n\nQuietLedger • Every case on record, every identity off record.`,
      });
      console.log(`[intake-service] Sent break-glass disclosure email to ${targetContactEmail}`);
    }
  } catch (err) {
    console.warn(`[fail-open] notifyBreakGlass error: ${err.message}`);
  }
}

module.exports = {
  sendNotification,
  sendEmail,
  sendSms,
  notifyReportCreated,
  notifyStatusUpdated,
  notifyMessageSent,
  notifyBreakGlass,
};
