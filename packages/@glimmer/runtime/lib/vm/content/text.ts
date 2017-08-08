import DynamicContentBase, { DynamicContent } from './dynamic';
import { SingleNodeBounds } from '../../bounds';
import { isNode, isSafeString, isEmpty, isString } from '../../dom/normalize';
import { Opaque } from "@glimmer/interfaces";

export default class DynamicTextContent extends DynamicContentBase {
  constructor(public bounds: SingleNodeBounds, private lastValue: string, trusted: boolean) {
    super(trusted);
  }

  update(value: Opaque): DynamicContent {
    let { lastValue } = this;

    if (value === lastValue) return this;
    if (isNode(value) || isSafeString(value)) return this.retry(value);

    let normalized: string;

    if (isEmpty(value)) {
      normalized = '';
    } else if (isString(value)) {
      normalized = value;
    } else {
      normalized = String(value);
    }

    if (normalized !== lastValue) {
      let textNode = this.bounds.firstNode();
      textNode.nodeValue = this.lastValue = normalized;
    }

    return this;
  }
}
