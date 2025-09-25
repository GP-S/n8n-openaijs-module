import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class UnsafeCodeApi implements ICredentialType {
  name = 'unsafeCodeApi';

  displayName = 'Unsafe Code API';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'url',
      type: 'string',
      default: '',
      placeholder: 'https://example.com',
      description: 'Base URL of the API',
      required: true,
    },
    {
      displayName: 'Bearer Token',
      name: 'token',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description: 'Token to use for bearer authentication',
      required: true,
    },
  ];
}
