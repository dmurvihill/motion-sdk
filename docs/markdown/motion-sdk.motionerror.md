<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [motion-sdk](./motion-sdk.md) &gt; [MotionError](./motion-sdk.motionerror.md)

## MotionError interface

Base interface for all errors returned by `motion-sdk`<!-- -->.

**Signature:**

```typescript
export interface MotionError 
```

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

[errorType](./motion-sdk.motionerror.errortype.md)


</td><td>

`readonly`


</td><td>

typeof [argumentErrorType](./motion-sdk.argumenterrortype.md) \| typeof [fetchErrorType](./motion-sdk.fetcherrortype.md) \| typeof [limiterErrorType](./motion-sdk.limitererrortype.md) \| typeof [queueOverflowErrorType](./motion-sdk.queueoverflowerrortype.md) \| typeof [closedErrorType](./motion-sdk.closederrortype.md) \| typeof [limitExceededErrorType](./motion-sdk.limitexceedederrortype.md) \| typeof [multiErrorType](./motion-sdk.multierrortype.md)


</td><td>

Indicates the class of the error.


</td></tr>
<tr><td>

[message](./motion-sdk.motionerror.message.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

Developer-readable error message.


</td></tr>
</tbody></table>
