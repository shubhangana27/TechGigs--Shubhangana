// src/utils/uploadImage.js
export const uploadImageToImgBB = async (file) => {
  const apiKey = "YOUR_IMGBB_API_KEY"; // Replace with your key
  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (data.success) {
      return data.data.url; // Returns direct URL to save in Firestore
    } else {
      throw new Error("Image upload failed");
    }
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};