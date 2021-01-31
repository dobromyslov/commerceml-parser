import {CommerceMlAbstractParser} from './abstract-parser';
import {
  Catalog,
  Classifier,
  ClassifierGroup,
  ClassifierProperty,
  CommercialInformation,
  Product
} from 'commerceml-parser-core';
import {convertToArray, parseCounterpartyXmlData} from './utils';

export class CommerceMlImportParser extends CommerceMlAbstractParser {
  /**
   * Parser rules.
   */
  protected rules = {
    commercialInformation: {
      start: ['КоммерческаяИнформация']
    },
    classifier: {
      start: ['КоммерческаяИнформация', 'Классификатор'],
      include: [
        ['КоммерческаяИнформация', 'Классификатор', 'Ид'],
        ['КоммерческаяИнформация', 'Классификатор', 'Наименование'],
        ['КоммерческаяИнформация', 'Классификатор', 'Владелец']
      ]
    },
    classifierGroup: {
      start: ['КоммерческаяИнформация', 'Классификатор', 'Группы', 'Группа'],
      include: [
        ['КоммерческаяИнформация', 'Классификатор', 'Группы', 'Группа']
      ]
    },
    classifierProperty: {
      start: ['КоммерческаяИнформация', 'Классификатор', 'Свойства', 'Свойство'],
      include: [
        ['КоммерческаяИнформация', 'Классификатор', 'Свойства', 'Свойство']
      ]
    },
    catalog: {
      start: ['КоммерческаяИнформация', 'Каталог'],
      include: [
        ['КоммерческаяИнформация', 'Каталог', 'Ид'],
        ['КоммерческаяИнформация', 'Каталог', 'ИдКлассификатора'],
        ['КоммерческаяИнформация', 'Каталог', 'Наименование'],
        ['КоммерческаяИнформация', 'Каталог', 'Владелец']
      ]
    },
    product: {
      start: ['КоммерческаяИнформация', 'Каталог', 'Товары', 'Товар'],
      include: [
        ['КоммерческаяИнформация', 'Каталог', 'Товары', 'Товар']
      ]
    }
  };

  /**
   * Parses commercial information schemaVersion and creationTimestamp attributes.
   * @param callback
   */
  public onCommercialInformation(
    callback: (commercialInformation: CommercialInformation) => void | Promise<void>
  ): void {
    this.eventEmitter.on('commercialInformation', async (data: any) => {
      const commercialInformation: CommercialInformation = {
        schemaVersion: data.КоммерческаяИнформация._ВерсияСхемы,
        creationTimestamp: new Date(data.КоммерческаяИнформация._ДатаФормирования)
      };

      await callback(commercialInformation);
    });
  }

  /**
   * Parses classifier block header without details.
   * @param callback
   */
  public onClassifier(
    callback: (classifier: Classifier) => void | Promise<void>
  ): void {
    this.eventEmitter.on('classifier', async (data: any) => {
      const classifierXml = data.Классификатор;
      const classifier: Classifier = {
        id: classifierXml.Ид,
        name: classifierXml.Наименование,
        owner: parseCounterpartyXmlData(classifierXml.Владелец)
      };

      await callback(classifier);
    });
  }

  /**
   * Parses classifier groups.
   * @param callback
   */
  public onClassifierGroup(
    callback: (classifierGroup: ClassifierGroup) => void | Promise<void>
  ): void {
    const processGroup = (groupData: any): ClassifierGroup => {
      const result: ClassifierGroup = {
        id: groupData.Ид,
        name: groupData.Наименование
      };

      const children: ClassifierGroup[] = [];
      for (const child of convertToArray(groupData.Группы?.Группа)) {
        children.push(processGroup(child));
      }

      if (children.length > 0) {
        result.groups = children;
      }

      return result;
    };

    this.eventEmitter.on('classifierGroup', async (data: any) => {
      const classifierGroupXml = data.Группа;
      const classifierGroup: ClassifierGroup = processGroup(classifierGroupXml);
      await callback(classifierGroup);
    });
  }

  /**
   * Parses classifier properties.
   * @param callback
   */
  public onClassifierProperty(
    callback: (classifierProperty: ClassifierProperty) => void | Promise<void>
  ): void {
    this.eventEmitter.on('classifierProperty', async (data: any) => {
      const propertyXml = data.Свойство;

      const classifierProperty: ClassifierProperty = {
        id: propertyXml.Ид,
        name: propertyXml.Наименование,
        type: propertyXml.ТипЗначений
      };

      if (propertyXml.ВариантыЗначений?.Справочник) {
        classifierProperty.dictionaryValues = [];
        for (const dictionaryValue of convertToArray(propertyXml.ВариантыЗначений?.Справочник)) {
          classifierProperty.dictionaryValues.push({
            id: dictionaryValue.ИдЗначения,
            value: dictionaryValue.Значение
          });
        }
      }

      await callback(classifierProperty);
    });
  }

  /**
   * Parses catalog header without details.
   * @param callback
   */
  public onCatalog(
    callback: (catalog: Catalog) => void | Promise<void>
  ): void {
    this.eventEmitter.on('catalog', async (data: any) => {
      const catalogXml = data.Каталог;
      const catalog: Catalog = {
        id: catalogXml.Ид,
        classifierId: catalogXml.ИдКлассификатора,
        name: catalogXml.Наименование,
        owner: parseCounterpartyXmlData(catalogXml.Владелец),
        products: []
      };

      await callback(catalog);
    });
  }

  /**
   * Parses catalog products.
   * @param callback
   */
  public onProduct(
    callback: (product: Product) => void | Promise<void>
  ): void {
    this.eventEmitter.on('product', async (data: any) => {
      const productXml = data.Товар;
      const product: Product = {
        id: productXml.Ид,
        article: productXml.Артикул,
        name: productXml.Наименование,
        baseMeasurementUnit: {
          code: productXml.БазоваяЕдиница._Код,
          fullName: productXml.БазоваяЕдиница._НаименованиеПолное,
          acronym: productXml.БазоваяЕдиница._МеждународноеСокращение
        },
        groupId: productXml.Группы.Ид,
        description: productXml.Описание
      };

      if (productXml.Картинка) {
        product.images = [];
        for (const imagePath of convertToArray(productXml.Картинка)) {
          product.images.push(imagePath);
        }
      }

      if (productXml.СтавкиНалогов?.СтавкаНалога) {
        product.taxRates = [];
        for (const taxRateXml of convertToArray(productXml.СтавкиНалогов?.СтавкаНалога)) {
          product.taxRates.push({
            name: taxRateXml.Наименование,
            rate: taxRateXml.Ставка
          });
        }
      }

      if (productXml.Штрихкод) {
        product.barcode = productXml.Штрихкод;
      }

      if (productXml.Изготовитель) {
        product.manufacturer = {
          id: productXml.Изготовитель.Ид,
          name: productXml.Изготовитель.Наименование
        };
      }

      if (productXml.ЗначенияСвойств?.ЗначенияСвойства) {
        product.propertyValues = [];
        for (const propertyValue of convertToArray(productXml.ЗначенияСвойств?.ЗначенияСвойства)) {
          // Multi values
          if (Array.isArray(propertyValue.Значение)) {
            product.propertyValues.push({
              id: propertyValue.Ид,
              values: propertyValue.Значение
            });
          } else {
            product.propertyValues.push({
              id: propertyValue.Ид,
              values: [propertyValue.Значение]
            });
          }
        }
      }

      if (productXml.ЗначенияРеквизитов?.ЗначениеРеквизита) {
        product.requisiteValues = [];
        for (const requisiteValue of convertToArray(productXml.ЗначенияРеквизитов?.ЗначениеРеквизита)) {
          // Multi values
          if (Array.isArray(requisiteValue.Значение)) {
            product.requisiteValues.push({
              name: requisiteValue.Наименование,
              values: requisiteValue.Значение
            });
          } else {
            product.requisiteValues.push({
              name: requisiteValue.Наименование,
              values: [requisiteValue.Значение]
            });
          }
        }
      }

      await callback(product);
    });
  }
}
