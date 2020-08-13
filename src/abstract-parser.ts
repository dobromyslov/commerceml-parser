import {createStream, QualifiedTag, SAXStream, Tag} from 'sax';
import {encodeXML} from 'entities/lib';
import X2JS from 'x2js';
import {Readable} from 'stream';

export interface CommerceMlRule {
  start: string[];
  include?: string[][];
}

export interface CommerceMlRules {
  [key: string]: CommerceMlRule;
}

export abstract class CommerceMlAbstractParser {
  /**
   * SAX Parser instance.
   */
  protected stream: SAXStream;

  /**
   * Current position in the xml file.
   * Array of tag names.
   */
  protected xPath: string[] = [];

  /**
   * Current open tag name.
   * Last tag name in xPath array.
   */
  protected openTag = '';

  /**
   * Current parser rule key which is processed.
   */
  protected currentRuleKey = '';

  /**
   *
   */
  protected xml = '';

  /**
   *
   */
  protected collectCurrentNode = false;

  /**
   *
   */
  protected collectOpenTags: string[] = [];

  protected abstract rules: CommerceMlRules;

  constructor() {
    this.stream = createStream(true, {
      trim: true,
      normalize: true
    });

    this.stream.on('opentag', (tag: Tag | QualifiedTag) => {
      this.onOpenTag(tag);
    });

    this.stream.on('closetag', (tagName: string) => {
      this.onCloseTag(tagName);
    });

    this.stream.on('text', (text: string) => {
      this.onText(text);
    });
  }

  /**
   * Starts parsing readable stream.
   * @param readStream
   */
  public async parse(readStream: Readable): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stream.on('end', () => {
        resolve();
      });

      this.stream.on('error', error => {
        reject(error);
      });

      readStream.pipe(this.stream);
    });
  }

  /**
   * Returns SAX stream.
   */
  public getStream(): SAXStream {
    return this.stream;
  }

  public end(): void {
    this.stream.end();
  }

  /**
   * SAX 'opentag' event handler.
   * @param tag
   */
  protected onOpenTag(tag: Tag | QualifiedTag) {
    this.openTag = tag.name;
    this.xPath.push(tag.name);
    this.collectCurrentNode = false;

    for (const [key, rule] of Object.entries(this.rules)) {
      // Check new rule start path
      if (this.isCurrentXPathEqualsToRuleXPath(rule.start)) {
        // If currentRule key already set then finish previous XML collection
        if (this.currentRuleKey) {
          this.emitCollected();
        }

        // Start new XML collection
        this.currentRuleKey = key;
      }
    }

    if (this.currentRuleKey && this.shallCollect()) {
      this.collectCurrentNode = true;
      this.xml += `<${tag.name}`;
      this.collectOpenTags.push(tag.name);

      for (const [key, value] of Object.entries(tag.attributes)) {
        this.xml += ` ${key}="${value as string}"`;
      }
    }

    this.xml += '>';
    return this.xml;
  }

  /**
   *
   */
  protected shallCollect(): boolean {
    for (const rule of Object.values(this.rules)) {
      if (this.isCurrentXPathEqualsToRuleXPath(rule.start)) {
        return true;
      }

      for (const ruleInclude of rule.include ?? []) {
        if (this.isCurrentXPathStartsWithRuleXPath(ruleInclude)) {
          return true;
        }
      }
    }

    return false;
  }

  protected emitCollected(): void {
    if (this.collectOpenTags.length > 0) {
      for (let i = this.collectOpenTags.length - 1; i >= 0; i--) {
        this.xml += `</${this.collectOpenTags[i]}>`;
      }
    }

    const x2js = new X2JS();
    this.stream?.emit(this.currentRuleKey, x2js.xml2js(this.xml));

    this.collectOpenTags = [];
    this.currentRuleKey = '';
    this.xml = '';
  }

  protected onText(text: string) {
    if (this.openTag && this.collectCurrentNode) {
      this.xml += encodeXML(text);
    }
  }

  protected onCloseTag(tagName: string) {
    if (this.currentRuleKey) {
      if (this.shallCollect()) {
        this.xml += `</${tagName}>`;
        this.collectOpenTags.pop();
      }

      if (this.isCurrentXPathEqualsToRuleXPath(this.rules[this.currentRuleKey].start)) {
        this.emitCollected();
      }
    }

    this.collectCurrentNode = false;
    this.openTag = '';
    this.xPath.pop();
  }

  protected isCurrentXPathEqualsToRuleXPath(xPath: string[]): boolean {
    return this.xPath.length === xPath.length && this.xPath.join('/') === xPath.join('/');
  }

  protected isCurrentXPathStartsWithRuleXPath(xPath: string[]): boolean {
    return this.xPath.length >= xPath.length && this.xPath.join('/').startsWith(xPath.join('/'));
  }
}
