import { CommerceMlImportParser } from '../src';
import { createReadStream } from "fs";

describe('CommerceMlParser', () => {
  it('is ok', async () => {
    const catalogImportParser = new CommerceMlImportParser();
    catalogImportParser.onCommercialInformation(commercialInformation => {
      console.log('commercialInformation', JSON.stringify(commercialInformation));
    });

    catalogImportParser.onClassifier(classifier => {
      console.log('classifier', JSON.stringify(classifier));
    });

    catalogImportParser.onClassifierGroup(classifierGroup => {
      console.log('classifierGroup', JSON.stringify(classifierGroup));
    });

    await catalogImportParser.parse(createReadStream('./data/import0_1_with_nested_groups.xml'));
    console.log('Done');
  });
});
