import type {
  IDataObject,
  IExecuteFunctions,
  INode,
  INodeExecutionData,
  INodeProperties,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createRequire } from 'module';
import { format } from 'util';

const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as new (...args: string[]) => (...funcArgs: any[]) => Promise<any>;

const isObject = (value: unknown): value is IDataObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isExecutionData = (value: unknown): value is INodeExecutionData =>
  isObject(value) &&
  (Object.prototype.hasOwnProperty.call(value, 'json') ||
    Object.prototype.hasOwnProperty.call(value, 'binary') ||
    Object.prototype.hasOwnProperty.call(value, 'pairedItem') ||
    Object.prototype.hasOwnProperty.call(value, 'error'));

const isTraversable = (value: unknown): value is IDataObject =>
  isObject(value) && typeof (value as { toJSON?: unknown }).toJSON !== 'function' && Object.keys(value).length > 0;

const standardizeOutput = (output: IDataObject): IDataObject => {
  const knownObjects = new WeakSet<object>();

  const standardizeRecursive = (obj: IDataObject): IDataObject => {
    for (const [key, val] of Object.entries(obj)) {
      if (!isTraversable(val)) continue;
      if (typeof val === 'object' && val !== null) {
        if (knownObjects.has(val as object)) {
          continue;
        }
        knownObjects.add(val as object);
      }
      const constructorName = (val as any)?.constructor?.name;
      (obj as any)[key] =
        constructorName && constructorName !== 'Object'
          ? JSON.stringify(val)
          : standardizeRecursive(val as IDataObject);
    }
    return obj;
  };

  return standardizeRecursive(output);
};

const normalizeResult = (
  node: INode,
  result: unknown,
  itemIndex?: number,
): INodeExecutionData[] => {
  const ensureExecutionData = (value: unknown): INodeExecutionData => {
    if (value === undefined) {
      throw new NodeOperationError(node, 'No data was returned from the script', {
        itemIndex,
      });
    }

    if (isExecutionData(value)) {
      const executionItem = value as INodeExecutionData;
      if (executionItem.json && isObject(executionItem.json)) {
        executionItem.json = standardizeOutput(executionItem.json);
      }
      return executionItem;
    }

    if (!isObject(value)) {
      throw new NodeOperationError(node, 'Code did not return an object', {
        itemIndex,
      });
    }

    const cloned = { ...(value as IDataObject) };
    return { json: standardizeOutput(cloned) };
  };

  if (Array.isArray(result)) {
    return result.map((entry) => ensureExecutionData(entry));
  }

  return [ensureExecutionData(result)];
};

const javascriptCodeDescription: INodeProperties[] = [
  {
    displayName: 'JavaScript',
    name: 'jsCode',
    type: 'string',
    typeOptions: {
      editor: 'codeNodeEditor',
      editorLanguage: 'javaScript',
    },
    default: '',
    description:
      'JavaScript code to execute.<br><br>Tip: You can use luxon vars like <code>$today</code> for dates and <code>$jmespath</code> for querying JSON structures. <a href="https://docs.n8n.io/nodes/n8n-nodes-base.function">Learn more</a>.',
    noDataExpression: true,
    displayOptions: {
      show: {
        mode: ['runOnceForAllItems'],
      },
    },
  },
  {
    displayName: 'JavaScript',
    name: 'jsCode',
    type: 'string',
    typeOptions: {
      editor: 'codeNodeEditor',
      editorLanguage: 'javaScript',
    },
    default: '',
    description:
      'JavaScript code to execute.<br><br>Tip: You can use luxon vars like <code>$today</code> for dates and <code>$jmespath</code> for querying JSON structures. <a href="https://docs.n8n.io/nodes/n8n-nodes-base.function">Learn more</a>.',
    noDataExpression: true,
    displayOptions: {
      show: {
        mode: ['runOnceForEachItem'],
      },
    },
  },
];

export class UnsafeCode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Unsafe Code',
    name: 'unsafeCode',
    icon: 'file:code.svg',
    group: ['transform'],
    version: 1,
    description: 'Run custom JavaScript without sandbox restrictions',
    defaults: {
      name: 'Unsafe Code',
    },
    inputs: ['main'],
    outputs: ['main'],
    parameterPane: 'wide',
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
      ...javascriptCodeDescription,
      {
        displayName:
          'Type <code>$</code> for a list of <a target="_blank" href="https://docs.n8n.io/code-examples/methods-variables-reference/">special vars/methods</a>. Debug by using <code>console.log()</code> statements and viewing their output in the browser console.',
        name: 'notice',
        type: 'notice',
        displayOptions: {
          show: {
            mode: ['runOnceForAllItems', 'runOnceForEachItem'],
          },
        },
        default: '',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const mode = this.getNodeParameter('mode', 0) as 'runOnceForAllItems' | 'runOnceForEachItem';
    const workflowMode = this.getMode();
    const requireFn = createRequire(__filename);

    const consoleBinding = (() => {
      if (workflowMode !== 'manual') {
        return console;
      }

      const manualConsole = Object.create(console) as Console;
      const consoleMethods = ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table'] as const;
      const sendMessage = this.sendMessageToUI.bind(this);

      const relayToUi = (args: unknown[]) => {
        const message = args.length === 0 ? '' : format(...(args as any[]));
        sendMessage(message);
      };

      for (const method of consoleMethods) {
        manualConsole[method] = (...args: unknown[]) => {
          relayToUi(args);
        };
      }

      return manualConsole;
    })();

    const runUserCode = async (index: number, contextData: IDataObject): Promise<unknown> => {
      const script = this.getNodeParameter('jsCode', index) as string;
      const dataProxy = this.getWorkflowDataProxy(index);

      const helpers = {
        ...this.helpers,
        httpRequestWithAuthentication: this.helpers.httpRequestWithAuthentication?.bind(this),
        requestWithAuthenticationPaginated:
          this.helpers.requestWithAuthenticationPaginated?.bind(this),
      };

      const module = { exports: {} as unknown };
      const initialModuleExports = module.exports;

      const context: Record<string | symbol, unknown> = {
        ...contextData,
        $getNodeParameter: this.getNodeParameter.bind(this),
        $getWorkflowStaticData: this.getWorkflowStaticData.bind(this),
        helpers,
        require: requireFn,
        module,
        exports: module.exports,
        process,
        console: consoleBinding,
        Buffer,
        __dirname: process.cwd(),
        __filename,
        global: globalThis,
        globalThis,
        fetch: (globalThis as any).fetch,
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
      };

      const contextProxy = new Proxy(context, {
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
          if (key in (globalThis as any)) {
            return (globalThis as any)[key];
          }
          return undefined;
        },
        set(target, key, value) {
          if (key === 'exports') {
            module.exports = value;
          }
          (target as any)[key] = value;
          return true;
        },
      });

      const asyncFunction = new AsyncFunction(
        'context',
        'with (context) { return (async () => {\n' + script + '\n})(); }',
      );

      let result: unknown;
      try {
        result = await asyncFunction(contextProxy);
      } catch (error) {
        throw new NodeOperationError(this.getNode(), (error as Error).message, {
          itemIndex: mode === 'runOnceForEachItem' ? index : undefined,
        });
      }

      if (result === undefined) {
        const moduleExports = module.exports;
        const exportsChanged =
          moduleExports !== initialModuleExports ||
          (isObject(moduleExports) && Object.keys(moduleExports).length > 0);
        if (moduleExports !== undefined && exportsChanged) {
          return moduleExports;
        }
      }

      return result;
    };

    if (mode === 'runOnceForAllItems') {
      const result = await runUserCode(0, { items });
      const normalized = normalizeResult(this.getNode(), result);
      normalized.forEach((item) => {
        if (item.json && isObject(item.json)) {
          item.json = standardizeOutput(item.json);
        }
      });
      return this.prepareOutputData(normalized);
    }

    const returnData: INodeExecutionData[] = [];
    for (let index = 0; index < items.length; index++) {
      const result = await runUserCode(index, { item: items[index] });
      const normalized = normalizeResult(this.getNode(), result, index);
      normalized.forEach((item) => {
        if (!item.pairedItem) {
          item.pairedItem = { item: index };
        }
        if (item.json && isObject(item.json)) {
          item.json = standardizeOutput(item.json);
        }
        returnData.push(item);
      });
    }

    return this.prepareOutputData(returnData);
  }
}
