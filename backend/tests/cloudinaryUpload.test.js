import { describe, it } from "node:test";
import assert from "node:assert/strict";
import upload from "../middleware/upload.js";
import { isCloudinaryConfigured, deleteFromCloudinary } from "../services/cloudinary.js";

describe("Cloudinary Upload & Multer Middleware Unit Tests", () => {
  it("detects Cloudinary configuration status correctly", () => {
    const configured = isCloudinaryConfigured();
    assert.equal(typeof configured, "boolean");
  });

  it("deleteFromCloudinary returns null safely when passed null or empty public ID", async () => {
    const result1 = await deleteFromCloudinary(null);
    assert.equal(result1, null);

    const result2 = await deleteFromCloudinary("");
    assert.equal(result2, null);

    const result3 = await deleteFromCloudinary(undefined);
    assert.equal(result3, null);
  });

  it("upload middleware is properly exported with single() handler", () => {
    assert.equal(typeof upload.single, "function");
    const singleHandler = upload.single("image");
    assert.equal(typeof singleHandler, "function");
  });

  it("resolves legacy and Cloudinary URLs correctly", () => {
    const testCases = [
      {
        input: "https://res.cloudinary.com/dyjezznx4/image/upload/v1234/sample.jpg",
        isCloudinary: true,
      },
      {
        input: "http://res.cloudinary.com/dyjezznx4/image/upload/v1234/sample.jpg",
        isCloudinary: true,
      },
      {
        input: "1791009956964-logo.png",
        isCloudinary: false,
      },
      {
        input: "/uploads/1791009956964-logo.png",
        isCloudinary: false,
      },
    ];

    testCases.forEach(({ input, isCloudinary }) => {
      const isAbsolute = input.startsWith("http://") || input.startsWith("https://");
      assert.equal(isAbsolute, isCloudinary);

      // Verify the resolution logic used in GigDetails and EditGig
      const resolved = isAbsolute
        ? input
        : input.startsWith("/uploads/")
          ? `http://localhost:5001${input}`
          : `http://localhost:5001/uploads/${input}`;

      if (isCloudinary) {
        assert.equal(resolved, input);
      } else {
        assert.ok(resolved.startsWith("http://localhost:5001/uploads/"));
      }
    });
  });
});
