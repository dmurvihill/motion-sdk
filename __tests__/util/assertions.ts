import { isMotionError, isMultiError, MotionError } from "../../src/error.js";

export function expectResponse(r: Response | MotionError): Response {
  expect(r).not.toMatchObject({
    errorType: expect.anything() as unknown,
  });
  if ("errorType" in r) {
    throw new Error("Shouldn't have got here");
  } else {
    return r;
  }
}

export function expectMotionError<T extends string>(
  o: unknown,
  errorType: T,
): o is MotionError & { errorType: T } {
  if (o !== null && typeof o === "object") {
    if (isMotionError(o)) {
      if (isMultiError(o)) {
        expect(o.errors).toContainEqual(expect.objectContaining({ errorType }));
      } else {
        expect(o).toEqual(expect.objectContaining({ errorType }));
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      throw new Error(`Expected a MotionError, got ${o.toString()}`);
    }
  } else {
    expect(o).toBeDefined();
    expect(typeof o).toEqual("object");
  }
  return true;
}
