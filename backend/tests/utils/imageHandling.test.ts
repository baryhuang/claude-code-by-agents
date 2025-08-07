import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { ImageHandler } from "../../utils/imageHandling.ts";

// Mock fs promises
vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  },
}));

describe("ImageHandler", () => {
  let imageHandler: ImageHandler;
  const testTempDir = "/tmp/test-agentrooms";
  
  beforeEach(() => {
    vi.clearAllMocks();
    imageHandler = new ImageHandler(testTempDir);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe("initialization", () => {
    it("should initialize temp directory", async () => {
      await imageHandler.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith(testTempDir, { recursive: true });
    });
    
    it("should handle mkdir errors gracefully", async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error("Permission denied"));
      
      // Should not throw
      await expect(imageHandler.initialize()).resolves.toBeUndefined();
    });
  });
  
  describe("saveImageFromBase64", () => {
    it("should save base64 image data to file", async () => {
      const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      const expectedBuffer = Buffer.from(base64Data, "base64");
      
      const filepath = await imageHandler.saveImageFromBase64(base64Data, "png", "test.png");
      
      expect(filepath).toBe(join(testTempDir, "test.png"));
      expect(fs.writeFile).toHaveBeenCalledWith(
        join(testTempDir, "test.png"),
        expectedBuffer
      );
    });
    
    it("should handle data URL prefixes", async () => {
      const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      const dataUrl = `data:image/png;base64,${base64Data}`;
      const expectedBuffer = Buffer.from(base64Data, "base64");
      
      await imageHandler.saveImageFromBase64(dataUrl, "png", "test.png");
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        join(testTempDir, "test.png"),
        expectedBuffer
      );
    });
    
    it("should generate filename if not provided", async () => {
      const base64Data = "test-data";
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
      
      const filepath = await imageHandler.saveImageFromBase64(base64Data);
      
      expect(filepath).toBe(join(testTempDir, "screenshot_1234567890.png"));
    });
  });
  
  describe("readImageAsBase64", () => {
    it("should read PNG image and return base64", async () => {
      const mockBuffer = Buffer.from("fake-png-data");
      vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);
      
      const result = await imageHandler.readImageAsBase64("/path/to/test.png");
      
      expect(result).toEqual({
        type: "base64",
        data: mockBuffer.toString("base64"),
        mimeType: "image/png",
      });
    });
    
    it("should detect MIME type from file extension", async () => {
      const mockBuffer = Buffer.from("fake-image-data");
      vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);
      
      const testCases = [
        { filepath: "/test.jpg", expectedMime: "image/jpeg" },
        { filepath: "/test.jpeg", expectedMime: "image/jpeg" },
        { filepath: "/test.png", expectedMime: "image/png" },
        { filepath: "/test.gif", expectedMime: "image/gif" },
        { filepath: "/test.webp", expectedMime: "image/webp" },
      ];
      
      for (const { filepath, expectedMime } of testCases) {
        const result = await imageHandler.readImageAsBase64(filepath);
        expect(result.mimeType).toBe(expectedMime);
      }
    });
  });
  
  describe("captureScreenshot", () => {
    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
      vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2023-01-01T00:00:00.000Z");
    });
    
    it("should capture screenshot successfully", async () => {
      const result = await imageHandler.captureScreenshot({
        format: "png",
        quality: 90,
      });
      
      expect(result.success).toBe(true);
      expect(result.imagePath).toBe(join(testTempDir, "screenshot_1234567890.png"));
      expect(result.imageData).toBeDefined();
      expect(result.metadata).toEqual({
        timestamp: "2023-01-01T00:00:00.000Z",
        format: "png",
        size: { width: 800, height: 600 },
      });
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        join(testTempDir, "screenshot_1234567890.png"),
        expect.any(Buffer)
      );
    });
    
    it("should handle different formats", async () => {
      const result = await imageHandler.captureScreenshot({ format: "jpg" });
      
      expect(result.success).toBe(true);
      expect(result.imagePath).toMatch(/\.jpg$/);
      expect(result.metadata.format).toBe("jpg");
    });
    
    it("should handle capture errors", async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("Disk full"));
      
      const result = await imageHandler.captureScreenshot();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Disk full");
      expect(result.metadata.timestamp).toBeDefined();
    });
    
    it("should handle region capture options", async () => {
      const result = await imageHandler.captureScreenshot({
        region: { x: 100, y: 100, width: 400, height: 300 },
        format: "png",
      });
      
      expect(result.success).toBe(true);
      // The mock implementation doesn't actually use region options,
      // but in real implementation this would be passed to capture command
    });
  });
  
  describe("cleanupTempImages", () => {
    it("should clean up old screenshot files", async () => {
      const mockFiles = [
        "screenshot_old.png",
        "screenshot_new.png", 
        "other_file.txt",
      ];
      
      const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const newTime = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      vi.mocked(fs.stat).mockImplementation(async (filepath) => {
        const filename = (filepath as string).split("/").pop();
        return {
          mtimeMs: filename === "screenshot_old.png" ? oldTime : newTime,
        } as any;
      });
      
      await imageHandler.cleanupTempImages(24 * 60 * 60 * 1000); // 24 hours
      
      expect(fs.unlink).toHaveBeenCalledWith(join(testTempDir, "screenshot_old.png"));
      expect(fs.unlink).not.toHaveBeenCalledWith(join(testTempDir, "screenshot_new.png"));
      expect(fs.unlink).not.toHaveBeenCalledWith(join(testTempDir, "other_file.txt"));
    });
    
    it("should handle cleanup errors gracefully", async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error("Access denied"));
      
      // Should not throw
      await expect(imageHandler.cleanupTempImages()).resolves.toBeUndefined();
    });
    
    it("should only clean screenshot files", async () => {
      const mockFiles = [
        "screenshot_test1.png",
        "regular_file.png",
        "screenshot_test2.jpg",
        "not_screenshot.png",
      ];
      
      const oldTime = Date.now() - (25 * 60 * 60 * 1000);
      
      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);
      vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: oldTime } as any);
      
      await imageHandler.cleanupTempImages(24 * 60 * 60 * 1000);
      
      expect(fs.unlink).toHaveBeenCalledWith(join(testTempDir, "screenshot_test1.png"));
      expect(fs.unlink).toHaveBeenCalledWith(join(testTempDir, "screenshot_test2.jpg"));
      expect(fs.unlink).not.toHaveBeenCalledWith(join(testTempDir, "regular_file.png"));
      expect(fs.unlink).not.toHaveBeenCalledWith(join(testTempDir, "not_screenshot.png"));
    });
  });
  
  describe("createPlaceholderImage", () => {
    it("should create valid PNG placeholder", async () => {
      const result = await imageHandler.captureScreenshot({ format: "png" });
      
      expect(result.success).toBe(true);
      expect(result.imageData).toBeDefined();
      
      // Check that the image data looks like a PNG (starts with PNG signature when decoded)
      const buffer = Buffer.from(result.imageData!, "base64");
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      
      expect(buffer.subarray(0, 8)).toEqual(pngSignature);
    });
    
    it("should handle non-PNG formats", async () => {
      const result = await imageHandler.captureScreenshot({ format: "jpg" });
      
      expect(result.success).toBe(true);
      expect(result.imageData).toBeDefined();
      // For non-PNG formats, it returns placeholder text
    });
  });
});