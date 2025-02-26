<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [motion-sdk](./motion-sdk.md) &gt; [LimitExceededError](./motion-sdk.limitexceedederror.md)

## LimitExceededError class

Motion returned 429 Limit Exceeded. We have overrun the rate limit.

**Signature:**

```typescript
export declare class LimitExceededError extends Error implements MotionError 
```
**Extends:** Error

**Implements:** [MotionError](./motion-sdk.motionerror.md)

## Remarks

See [isLimitExceededError()](./motion-sdk.islimitexceedederror.md) for a built-in way to identify [LimitExceededError](./motion-sdk.limitexceedederror.md) objects.

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(response)](./motion-sdk.limitexceedederror._constructor_.md)


</td><td>


</td><td>

Constructs a new instance of the `LimitExceededError` class


</td></tr>
</tbody></table>

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[errorType](./motion-sdk.limitexceedederror.errortype.md)


</td><td>


</td><td>

typeof [limitExceededErrorType](./motion-sdk.limitexceedederrortype.md)


</td><td>

Indicates the class of the error.


</td></tr>
<tr><td>

[response](./motion-sdk.limitexceedederror.response.md)


</td><td>

`readonly`


</td><td>

Response


</td><td>

[Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) that was returned by Motion.


</td></tr>
</tbody></table>
