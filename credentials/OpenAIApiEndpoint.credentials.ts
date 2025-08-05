import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class OpenAIApiEndpoint implements ICredentialType {
  name = 'openAiApiEndpoint';
  displayName = 'OpenAI API Endpoint';
  documentationUrl = 'https://platform.openai.com/docs/api-reference';

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      default: '',
      required: true,
      typeOptions: {
        password: true,
      },
      description: 'Your OpenAI API key',
    },
    {
      displayName: 'API Base URL',
      name: 'baseUrl',
      type: 'string',
      default: '',
      required: false,
      description:
        'Optional custom base URL for the OpenAI API. Leave blank to use the default https://api.openai.com/v1.',
    },
  ];
}
