
import { v2 as cloudinary } from "cloudinary";

/**
 * Checks whether all required Cloudinary environment variables exist.
 */
export const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

/**
 * Configures Cloudinary using the current environment variables.
 * Called when an upload or deletion is requested.
 */
const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary credentials are not properly configured on the server."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
};

/**
 * Uploads a file buffer to Cloudinary using upload_stream.
 *
 * @param {Buffer} buffer - File buffer from Multer memoryStorage.
 * @param {Object} options - Cloudinary upload options.
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export const uploadStream = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      configureCloudinary();
    } catch (error) {
      return reject(error);
    }

    const defaultOptions = {
      folder: "gigflow/gigs",
      resource_type: "image",
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(
      defaultOptions,
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(
            new Error("Cloudinary upload completed without a result.")
          );
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    stream.on("error", reject);
    stream.end(buffer);
  });
};

/**
 * Deletes a Cloudinary asset using its public ID.
 *
 * @param {string} publicId - Public ID of the Cloudinary asset.
 * @returns {Promise<Object|null>}
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) {
    return null;
  }

  try {
    configureCloudinary();
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Failed to delete Cloudinary asset:", err.message);
    return null;
  }
};

export default cloudinary;
