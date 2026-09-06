process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'error';
process.env.JWT_SECRET ??= 'test-secret-agroflete-1234567890';
process.env.TABLE_NAME ??= 'AgrofleteTable-test';
process.env.DYNAMO_ENDPOINT ??= 'http://localhost:8010';
