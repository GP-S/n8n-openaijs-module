import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
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
    credentials: [],
    properties: [
      {
        displayName: 'API Key',
        name: 'apiKey',
        type: 'string',
        default: '',
        required: true,
        description: 'Your OpenAI API key',
        typeOptions: { password: true },
      },
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
    const apiKey = this.getNodeParameter('apiKey', 0) as string;
    const script = this.getNodeParameter('script', 0) as string;
    const openai = new OpenAI({ apiKey });

    const asyncFunction = new Function(
      'openai',
      'input',
      'require',
      'return (async () => {' + String.fromCharCode(10) + script + String.fromCharCode(10) + '})();',
    );

    let result;
    try {
      result = await asyncFunction(openai, items, require);
    } catch (error) {
      throw new NodeOperationError(this.getNode(), (error as Error).message);
    }
    return this.prepareOutputData(result as any);
  }
}
