<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [motion-sdk](./motion-sdk.md) &gt; [ArgumentError](./motion-sdk.argumenterror.md)

## ArgumentError class

An illegal argument was passed to a function or method

**Signature:**

```typescript
export declare class ArgumentError<T> extends Error implements MotionError 
```
**Extends:** Error

**Implements:** [MotionError](./motion-sdk.motionerror.md)

## Remarks

See [isArgumentError()](./motion-sdk.isargumenterror.md) for a built-in way to identify [ArgumentError](./motion-sdk.argumenterror.md) objects

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(argumentName, argumentValue, message)](./motion-sdk.argumenterror._constructor_.md)


</td><td>


</td><td>

Constructs a new instance of the `ArgumentError` class


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

[argumentName](./motion-sdk.argumenterror.argumentname.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

Name of the invalid argument


</td></tr>
<tr><td>

[argumentValue](./motion-sdk.argumenterror.argumentvalue.md)


</td><td>

`readonly`


</td><td>

T


</td><td>

Value of the invalid argument


</td></tr>
<tr><td>

[errorType](./motion-sdk.argumenterror.errortype.md)


</td><td>


</td><td>

typeof [argumentErrorType](./motion-sdk.argumenterrortype.md)


</td><td>

Indicates the class of the error


</td></tr>
<tr><td>

[message](./motion-sdk.argumenterror.message.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

Developer-readable error message


</td></tr>
</tbody></table>