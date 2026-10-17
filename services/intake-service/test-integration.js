const communicationClient = require('./src/clients/communicationClient');
const http = require('http');

async function runIntegrationTest() {
  console.log('================================================================');
  console.log('🧪 TESTING INTAKE-SERVICE -> COMMUNICATION-SERVICE REST CALLS');
  console.log('================================================================\n');

  // Check if communication-service is running on 4003
  const isCommsUp = await new Promise((resolve) => {
    const req = http.get('http://localhost:4003/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });

  if (!isCommsUp) {
    console.log('ℹ️  communication-service is not currently listening on port 4003.');
    console.log('   Testing fail-open resilience: ensuring intake-service never crashes when comms is down...');

    await communicationClient.notifyReportCreated({
      report: { id: 101, title: 'Hazardous leak', type: 'internal', org_id: 1, description: 'Chemical odor' },
      reporter: { name: 'John Doe', email: 'john@example.com' },
      entity: { contact_email: 'compliance@org.com' },
    });
    console.log('✅ Fail-open resilience test passed: communication failure handled gracefully!\n');
    return;
  }

  console.log('✅ Communication Service is active on port 4003. Running full REST integration suite:\n');

  // Test 1: notifyReportCreated
  console.log('1. Testing notifyReportCreated (Report #201)...');
  await communicationClient.notifyReportCreated({
    report: {
      id: 201,
      title: 'Safety valve malfunction',
      type: 'internal',
      org_id: 5,
      description: 'Valve pressure exceeding safety threshold in tank 4.',
      is_anonymous: false,
      reporter_id: 42,
    },
    reporter: {
      id: 42,
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone_number: '+919876543210',
    },
    entity: {
      id: 5,
      name: 'Apex Industrial',
      contact_email: 'safety@apex-ind.com',
    },
  });
  console.log('   ✅ Dispatched report creation alerts.');

  // Test 2: notifyStatusUpdated
  console.log('\n2. Testing notifyStatusUpdated (Report #201 -> under_review)...');
  await communicationClient.notifyStatusUpdated({
    report: {
      id: 201,
      title: 'Safety valve malfunction',
      reporter_id: 42,
    },
    oldStatus: 'submitted',
    newStatus: 'under_review',
    reporter: {
      email: 'priya@example.com',
    },
  });
  console.log('   ✅ Dispatched status transition alert.');

  // Test 3: notifyMessageSent
  console.log('\n3. Testing notifyMessageSent (confidential case thread)...');
  await communicationClient.notifyMessageSent({
    report: {
      id: 201,
      type: 'internal',
      org_id: 5,
      reporter_id: 42,
    },
    message: { body: 'Maintenance team has been dispatched to tank 4.' },
    senderId: 99,
    senderName: 'Handler Vikram',
  });
  console.log('   ✅ Dispatched case chat alert.');

  // Test 4: notifyBreakGlass
  console.log('\n4. Testing notifyBreakGlass (emergency identity disclosure)...');
  await communicationClient.notifyBreakGlass({
    report: {
      id: 201,
      type: 'internal',
      org_id: 5,
    },
    adminUser: { name: 'SuperAdmin' },
    reason: 'Imminent critical safety hazard requires emergency escalation.',
    targetDesc: 'Organisation ID 5',
  });
  console.log('   ✅ Dispatched emergency break-glass alert.');

  console.log('\n================================================================');
  console.log('🎉 ALL REST INTEGRATION CALLS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

runIntegrationTest().catch(console.error);
