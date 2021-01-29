import {CommerceMlImportParser} from 'commerceml-parser';
import {createReadStream} from 'fs';

describe('async import', () => {
  it('should be sequential', async () => {
    const readable = createReadStream('./data/import0_1_with_nested_groups.xml');
    const parser = new CommerceMlImportParser();

    parser.onCommercialInformation(commercialInformation => {
      return new Promise((resolve, reject) => {
        console.log('Commercial Information');
      });
    });

    parser.onClassifier(classifier => {
      return new Promise((resolve, reject) => {
        console.log('Classifier');
      });
    });

    parser.onClassifierGroup(classifierGroup => {
      return new Promise((resolve, reject) => {
        console.log('Classifier group');
      });
    });

    parser.onClassifierProperty(classifierProperty => {
      return new Promise((resolve, reject) => {
        console.log('Classifier property');
      });
    });

    parser.onCatalog(catalog => {
      return new Promise((resolve, reject) => {
        for (let i = 0; i < 10000000; i++) {}
        console.log('Catalog');
      });
    });

    parser.onProduct(product => {
      return new Promise((resolve, reject) => {
        console.log('Product');
      });
    });

    parser.onEnd(() => {
      console.log('End');
    });

    await parser.parse(readable);
    readable.destroy();
    console.log('Done');
  });
});
