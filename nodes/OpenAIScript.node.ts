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
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Run Once for All Items',
            value: 'runOnceForAllItems',
            description: 'Run this code only once, no matter how many input items there are',
          },
          {
            name: 'Run Once for Each Item',
            value: 'runOnceForEachItem',
            description: 'Run this code as many times as there are input items',
          },
        ],
        default: 'runOnceForAllItems',
      },
      {
        displayName: 'Script',
        name: 'script',
        type: 'string',
        typeOptions: {
          editor: 'codeNodeEditor',
          editorLanguage: 'javaScript',
        },
        default: '',
        description:
          'Asynchronous JavaScript to execute. You can access `openai`, `input`, `require`, `fetch`, `JSON`, and workflow helpers like `$json` and `$input`.',
        noDataExpression: true,
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
    const mode = this.getNodeParameter('mode', 0) as string;

    const config: Record<string, any> = { apiKey };
    if (baseUrl) {
      config.baseURL = baseUrl;
    }
    const client = new OpenAI(config);
    const openai = client;

    const requireFn = createRequire(__filename);

    const createWorkflowProxy = (index: number, inputData: any) => {
      const dataProxy = this.getWorkflowDataProxy(index);
      return new Proxy(
        {
          openai,
          client,
          input: inputData,
          item: inputData,
          require: requireFn,
          console,
          fetch: (globalThis as any).fetch,
          JSON: (globalThis as any).JSON,
        },
        {
          has() {
            return true;
          },
          get(target, key) {
            if (key in target) {
              return (target as any)[key];
            }
            if (key in (dataProxy as any)) {
              return (dataProxy as any)[key];
            }
            return (globalThis as any)[key];
          },
        },
      );
    };

    const asyncFunction = new Function(
      'workflow',
      'with (workflow) { return (async () => {' + '\n' + script + '\n' + '})(); }',
    );

    const returnData: INodeExecutionData[] = [];

    if (mode === 'runOnceForAllItems') {
      let result: unknown;
      try {
        result = await asyncFunction(createWorkflowProxy(0, items));
      } catch (error) {
        throw new NodeOperationError(this.getNode(), (error as Error).message);
      }

      if (result === undefined) {
        throw new NodeOperationError(this.getNode(), 'No data was returned from the script');
      }

      try {
        returnData.push(
          ...(this.helpers.returnJsonArray(result as any) as INodeExecutionData[]),
        );
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          'The script result could not be converted into items',
        );
      }
    } else {
      for (let i = 0; i < items.length; i++) {
        let result: unknown;
        try {
          result = await asyncFunction(createWorkflowProxy(i, items[i]));
        } catch (error) {
          throw new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex: i });
        }

        if (result === undefined) {
          throw new NodeOperationError(
            this.getNode(),
            'No data was returned from the script',
            { itemIndex: i },
          );
        }

        try {
          returnData.push(
            ...(this.helpers.returnJsonArray(result as any) as INodeExecutionData[]),
          );
        } catch (error) {
          throw new NodeOperationError(
            this.getNode(),
            'The script result could not be converted into items',
            { itemIndex: i },
          );
        }
      }
    }

    return this.prepareOutputData(returnData);
  }
}
