<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [motion-sdk](./motion-sdk.md) &gt; [FetchError](./motion-sdk.fetcherror.md)

## FetchError class

There was an error in making the request.

**Signature:**

```typescript
export declare class FetchError extends Error implements MotionError 
```
**Extends:** Error

**Implements:** [MotionError](./motion-sdk.motionerror.md)

## Remarks

See [isFetchError()](./motion-sdk.isfetcherror.md) for a built-in way to identify [FetchError](./motion-sdk.fetcherror.md) objects.

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(cause, request)](./motion-sdk.fetcherror._constructor_.md)


</td><td>


</td><td>

Constructs a new instance of the `FetchError` class


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

[cause](./motion-sdk.fetcherror.cause.md)


</td><td>

`readonly`


</td><td>

unknown


</td><td>

The underlying error that was thrown by [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)<!-- -->.


</td></tr>
<tr><td>

[errorType](./motion-sdk.fetcherror.errortype.md)


</td><td>

`readonly`


</td><td>

typeof [fetchErrorType](./motion-sdk.fetcherrortype.md)


</td><td>

Indicates the class of the error.


</td></tr>
<tr><td>

[request](./motion-sdk.fetcherror.request.md)


</td><td>

`readonly`


</td><td>

{ input: string \| URL \| globalThis.Request; init?: RequestInit; }


</td><td>

The failing parameters to [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)<!-- -->.


</td></tr>
</tbody></table>
