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
  try {
    const startTime = new Date();
    console.log('🚀 Lambda function started');
    console.log('📅 Event:', JSON.stringify(event, null, 2));
    console.log('⚙️ Context:', {
      functionName: context.functionName,
      requestId: context.requestId,
      remainingTime: context.remainingTimeInMillis
    });
    console.log('🕐 Execution time:', startTime.toISOString());
    console.log('');

    // Run the main Caffe Nero benefit logic
    await manageCaffeNeroBenefit();

    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();

    console.log('');
    console.log('✅ Lambda execution completed successfully');
    console.log(`⏱️ Total execution time: ${executionTime}ms`);
    console.log('🕐 Completed at:', endTime.toISOString());

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Successfully processed Caffe Nero benefit check',
        executionTime: `${executionTime}ms`,
        timestamp: endTime.toISOString(),
        requestId: context.requestId
      }, null, 2)
    };

  } catch (error) {
    const errorTime = new Date();
    console.error('❌ Lambda execution failed');
    console.error('🕐 Error time:', errorTime.toISOString());
    console.error('💥 Error details:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        stack: errorStack,
        timestamp: errorTime.toISOString(),
        requestId: context.requestId
      }, null, 2)
    };
  }
};