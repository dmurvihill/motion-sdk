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

export function expectMotionError(o: unknown, errorType: string) {
  if (o !== null && typeof o === "object") {
    if (isMotionError(o)) {
      if (isMultiError(o)) {
        expect(o.errors).toContainEqual(expect.objectContaining({ errorType }));
      } else {
        expect(o).toEqual(expect.objectContaining({ errorType }));
      }
    }
  } else {
    expect(o).toBeDefined();
    expect(typeof o).toEqual("object");
  }
}
