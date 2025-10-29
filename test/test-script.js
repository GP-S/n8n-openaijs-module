const { UnsafeCode } = require('../dist/nodes/UnsafeCode.node.js');

(async () => {
  const node = new UnsafeCode();

  const baseContext = {
    getWorkflowDataProxy() {
      return {};
    },
    getWorkflowStaticData() {
      return {};
    },
    continueOnFail() {
      return false;
    },
    async getCredentials() {
      return null;
    },
    helpers: {},
    prepareOutputData(data) {
      return [data];
    },
    sendMessageToUI() {},
  };

  const successContext = {
    ...baseContext,
    getInputData() {
      return [
        { json: { value: 1 } },
        { json: { value: 2 } },
      ];
    },
    getNodeParameter(name) {
      if (name === 'mode') {
        return 'runOnceForAllItems';
      }
      if (name === 'jsCode') {
        return (
          "const path = require('path');" +
          "\nreturn items.map((item, index) => ({" +
          "\n  json: {" +
          "\n    original: item.json.value," +
          "\n    doubled: item.json.value * 2," +
          "\n    basename: path.basename(__filename)," +
          "\n    index," +
          "\n  }," +
          "\n}));"
        );
      }
      return '';
    },
    getMode() {
      return 'integrated';
    },
    getNode() {
      return { name: 'Unsafe Code' };
    },
  };

  const result = await node.execute.call(successContext);
  console.log('success', JSON.stringify(result));

  const errorScript = "nonExistentFunction();\nreturn [{ json: { ok: true } }];";

  const errorBase = {
    ...baseContext,
    getInputData() {
      return [{ json: { value: 1 } }];
    },
    getNodeParameter(name) {
      if (name === 'mode') {
        return 'runOnceForAllItems';
      }
      if (name === 'jsCode') {
        return errorScript;
      }
      return '';
    },
    getMode() {
      return 'manual';
    },
  };

  const errorOutputContext = {
    ...errorBase,
    getNode() {
      return { name: 'Unsafe Code', onError: 'continueErrorOutput' };
    },
    continueOnFail() {
      return true;
    },
  };

  const mainOutputContext = {
    ...errorBase,
    getNode() {
      return { name: 'Unsafe Code', onError: 'continueRegularOutput' };
    },
    continueOnFail() {
      return true;
    },
  };

  const errorOutputResult = await node.execute.call(errorOutputContext);
  console.log('errorOutput', JSON.stringify(errorOutputResult));

  const mainOutputResult = await node.execute.call(mainOutputContext);
  console.log('mainOutput', JSON.stringify(mainOutputResult));
})();
