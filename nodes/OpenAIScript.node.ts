import type {
  ICredentialDataDecryptedObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import OpenAI from 'openai';
import { createRequire } from 'module';

export class OpenAIScript implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpenAI Script',
    name: 'openAIScript',
    group: ['transform'],
    version: 1,
    description: 'Execute arbitrary JavaScript with access to the OpenAI SDK',
    icon: 'file:openai.svg',
    defaults: {
      name: 'OpenAI Script',
    },
    inputs: ['main'],
    outputs: ['main'],
    parameterPane: 'wide',
    credentials: 
    [
      {
        name: 'openAiApiEndpoint',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Script',
        name: 'script',
        type: 'string',
        noDataExpression: true,
        typeOptions: {
          editor: 'codeNodeEditor',
          language: 'javascript',
        },
        default: '',
        placeholder: 'return input;',
        description:
          'Asynchronous JavaScript to execute. You can access `openai`, `input`, `require`, and workflow helpers like `$json` and `$input`.',
        required: true,
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = (await this.getCredentials('openAiApiEndpoint')) as ICredentialDataDecryptedObject;
    const apiKey = credentials.apiKey as string;
    const baseUrl = (credentials.baseUrl as string) || '';
    const script = this.getNodeParameter('script', 0) as string;

    const config: Record<string, any> = { apiKey };
    if (baseUrl) {
      config.baseURL = baseUrl;
    }
    const openai = new OpenAI(config);

    const requireFn = createRequire(__filename);
    const dataProxy = this.getWorkflowDataProxy(0);
    const workflow = new Proxy(
      { openai, input: items, require: requireFn },
      {
        has: () => true,
        get(target, key) {
          if (key in target) {
            return (target as any)[key];
          }
          return (dataProxy as any)[key];
        },
      },
    );
    const asyncFunction = new Function(
      'workflow',
      'with (workflow) { return (async () => {' + '\n' + script + '\n' + '})(); }',
    );

    let result: unknown;
    try {
      result = await asyncFunction(workflow);
    } catch (error) {
      throw new NodeOperationError(this.getNode(), (error as Error).message);
    }

    if (result === undefined) {
      throw new NodeOperationError(this.getNode(), 'No data was returned from the script');
    }

    let returnData: INodeExecutionData[];
    try {
      returnData = this.helpers.returnJsonArray(result as any) as INodeExecutionData[];
    } catch (error) {
      throw new NodeOperationError(
        this.getNode(),
        'The script result could not be converted into items',
      );
    }

    return this.prepareOutputData(returnData);
  }
}
