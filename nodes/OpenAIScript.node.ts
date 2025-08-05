import type { ICredentialDataDecryptedObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import OpenAI from 'openai';

export class OpenAIScript implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpenAI Script',
    name: 'openAIScript',
    group: ['transform'],
    version: 1,
    description: 'Execute arbitrary JavaScript with access to the OpenAI SDK',
    defaults: {
      name: 'OpenAI Script',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
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
        typeOptions: {
          rows: 8,
          alwaysOpenEditWindow: true,
        },
        default: '',
        placeholder: 'return input;',
        description: 'Asynchronous JavaScript to execute. You can access `openai`, `input`, and `require`.',
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

    const asyncFunction = new Function(
      'openai',
      'input',
      'require',
      'return (async () => {' + '\n' + script + '\n' + '})();',
    );

    let result: unknown;
    try {
      result = await asyncFunction(openai, items, require);
    } catch (error) {
      throw new NodeOperationError(this.getNode(), (error as Error).message);
    }
    return this.prepareOutputData(result as any);
  }
}
