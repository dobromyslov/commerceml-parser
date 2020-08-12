import {CommerceMlImportParser} from '../src/import-parser';
import {createReadStream} from "fs";

describe('CommerceMlParser', () => {
  it('is ok', async () => {
    const stream = new CommerceMlImportParser().createStream();
    stream.on('classifier', data => {
      console.log('classifier:', JSON.stringify(data));
    });

    stream.on('classifierGroup', data => {
      console.log('classifierGroup:', JSON.stringify(data));
    });

    stream.on('error', error => {
      console.log('error', error);
    });

    createReadStream('./data/import0_1_with_nested_groups.xml').pipe(stream);
  });
});
