import { manageCaffeNeroBenefit } from './index';

interface LambdaEvent {
  source?: string;
  'detail-type'?: string;
  time?: string;
}

interface LambdaContext {
  functionName: string;
  functionVersion: string;
  requestId: string;
  logGroupName: string;
  logStreamName: string;
  remainingTimeInMillis: number;
}

interface LambdaResponse {
  statusCode: number;
  body: string;
}

export const handler = async (
  event: LambdaEvent, 
  context: LambdaContext
): Promise<LambdaResponse> => {
  const startTime = new Date();
  const requestId = context.requestId;
  
  try {
    console.log('🚀 LAMBDA_START | Caffe Nero Benefit Checker');
    console.log(`📋 REQUEST_ID: ${requestId}`);
    console.log(`� START_TIME: ${startTime.toISOString()}`);
    console.log(`⚙️ FUNCTION: ${context.functionName} (${context.functionVersion})`);
    console.log(`📊 MEMORY_LIMIT: ${context.remainingTimeInMillis}ms remaining`);
    
    if (event.source === 'aws.events') {
      console.log('⏰ TRIGGER: Scheduled EventBridge event');
      console.log(`📅 EVENT_TIME: ${event.time}`);
    } else {
      console.log('🔧 TRIGGER: Manual invocation');
    }
    
    console.log('');
    console.log('🔍 Starting Caffe Nero benefit processing...');

    // Run the main Caffe Nero benefit logic
    await manageCaffeNeroBenefit();

    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();

    console.log('');
    console.log('✅ SUCCESS | Lambda execution completed');
    console.log(`⏱️ EXECUTION_TIME: ${executionTime}ms`);
    console.log(`🕐 END_TIME: ${endTime.toISOString()}`);
    console.log(`📋 REQUEST_ID: ${requestId}`);
    console.log('🎉 Caffe Nero benefit check completed successfully!');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Successfully processed Caffe Nero benefit check',
        executionTime: `${executionTime}ms`,
        timestamp: endTime.toISOString(),
        requestId: requestId,
        functionName: context.functionName
      }, null, 2)
    };

  } catch (error) {
    const errorTime = new Date();
    const executionTime = errorTime.getTime() - startTime.getTime();
    
    console.error('');
    console.error('❌ FAILURE | Lambda execution failed');
    console.error(`� ERROR_TIME: ${errorTime.toISOString()}`);
    console.error(`⏱️ EXECUTION_TIME: ${executionTime}ms`);
    console.error(`📋 REQUEST_ID: ${requestId}`);
    console.error('� Error details:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`📝 ERROR_MESSAGE: ${errorMessage}`);
    if (errorStack) {
      console.error('📋 STACK_TRACE:', errorStack);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        stack: errorStack,
        executionTime: `${executionTime}ms`,
        timestamp: errorTime.toISOString(),
        requestId: requestId,
        functionName: context.functionName
      }, null, 2)
    };
  }
};