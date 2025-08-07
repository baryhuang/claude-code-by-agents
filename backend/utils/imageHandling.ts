import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { ProviderImage } from "../providers/types.ts";

export interface ScreenshotCapture {
  success: boolean;
  imagePath?: string;
  imageData?: string; // base64
  error?: string;
  metadata: {
    timestamp: string;
    format: string;
    size?: {
      width: number;
      height: number;
    };
  };
}

export class ImageHandler {
  private tempDir: string;
  
  constructor(tempDir: string = "/tmp/agentrooms") {
    this.tempDir = tempDir;
  }
  
  /**
   * Initialize temporary directory for image storage
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create temp directory:", error);
    }
  }
  
  /**
   * Save base64 image data to temporary file
   */
  async saveImageFromBase64(
    base64Data: string,
    format: string = "png",
    filename?: string
  ): Promise<string> {
    if (!filename) {
      filename = `screenshot_${Date.now()}.${format}`;
    }
    
    const filepath = join(this.tempDir, filename);
    
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
    
    await fs.writeFile(filepath, Buffer.from(cleanBase64, "base64"));
    
    return filepath;
  }
  
  /**
   * Read image file and convert to base64
   */
  async readImageAsBase64(filepath: string): Promise<ProviderImage> {
    const buffer = await fs.readFile(filepath);
    const base64Data = buffer.toString("base64");
    
    // Determine MIME type from file extension
    const ext = filepath.split(".").pop()?.toLowerCase();
    let mimeType = "image/png";
    
    switch (ext) {
      case "jpg":
      case "jpeg":
        mimeType = "image/jpeg";
        break;
      case "png":
        mimeType = "image/png";
        break;
      case "gif":
        mimeType = "image/gif";
        break;
      case "webp":
        mimeType = "image/webp";
        break;
    }
    
    return {
      type: "base64",
      data: base64Data,
      mimeType,
    };
  }
  
  /**
   * Capture screenshot using system commands
   * This is a mock implementation - in practice would use platform-specific tools
   */
  async captureScreenshot(
    options: {
      region?: { x: number; y: number; width: number; height: number };
      format?: "png" | "jpg";
      quality?: number;
    } = {}
  ): Promise<ScreenshotCapture> {
    const { format = "png", quality: _quality = 90 } = options;
    const timestamp = new Date().toISOString();
    const filename = `screenshot_${Date.now()}.${format}`;
    const filepath = join(this.tempDir, filename);
    
    try {
      // Mock implementation - in practice would use:
      // - macOS: screencapture -x -t png /path/to/file
      // - Linux: scrot /path/to/file or gnome-screenshot --file=/path/to/file
      // - Windows: powershell screenshot commands
      
      // For testing, create a simple placeholder image
      const placeholderImage = await this.createPlaceholderImage(800, 600, format);
      await fs.writeFile(filepath, placeholderImage);
      
      // Convert to base64 for easy transmission
      const imageData = placeholderImage.toString("base64");
      
      return {
        success: true,
        imagePath: filepath,
        imageData,
        metadata: {
          timestamp,
          format,
          size: { width: 800, height: 600 },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp,
          format,
        },
      };
    }
  }
  
  /**
   * Create a placeholder image for testing
   */
  private async createPlaceholderImage(
    width: number,
    height: number,
    format: string
  ): Promise<Buffer> {
    // Create a simple PNG header for a placeholder image
    // This is a minimal implementation for testing
    
    if (format === "png") {
      // PNG signature
      const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      
      // IHDR chunk
      const ihdrData = Buffer.alloc(13);
      ihdrData.writeUInt32BE(width, 0);
      ihdrData.writeUInt32BE(height, 4);
      ihdrData[8] = 8; // bit depth
      ihdrData[9] = 2; // color type (RGB)
      ihdrData[10] = 0; // compression
      ihdrData[11] = 0; // filter
      ihdrData[12] = 0; // interlace
      
      const ihdrLength = Buffer.alloc(4);
      ihdrLength.writeUInt32BE(13, 0);
      
      const ihdrType = Buffer.from("IHDR");
      const ihdrCrc = Buffer.alloc(4);
      ihdrCrc.writeUInt32BE(0x1A2F3E4D, 0); // placeholder CRC
      
      // Simple IDAT chunk with minimal data
      const idatLength = Buffer.alloc(4);
      idatLength.writeUInt32BE(10, 0);
      const idatType = Buffer.from("IDAT");
      const idatData = Buffer.from([0x78, 0x9C, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
      const idatCrc = Buffer.alloc(4);
      idatCrc.writeUInt32BE(0x5AFBE23C, 0); // placeholder CRC
      
      // IEND chunk
      const iendLength = Buffer.alloc(4);
      const iendType = Buffer.from("IEND");
      const iendCrc = Buffer.alloc(4);
      iendCrc.writeUInt32BE(0xAE426082, 0);
      
      return Buffer.concat([
        signature,
        ihdrLength, ihdrType, ihdrData, ihdrCrc,
        idatLength, idatType, idatData, idatCrc,
        iendLength, iendType, iendCrc
      ]);
    }
    
    // For other formats, return a minimal buffer
    return Buffer.from("Placeholder image data");
  }
  
  /**
   * Clean up temporary images older than specified age
   */
  async cleanupTempImages(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      
      for (const file of files) {
        if (file.startsWith("screenshot_")) {
          const filepath = join(this.tempDir, file);
          const stats = await fs.stat(filepath);
          
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.unlink(filepath);
          }
        }
      }
    } catch (error) {
      console.error("Failed to cleanup temp images:", error);
    }
  }
}

// Global image handler instance
export const globalImageHandler = new ImageHandler();