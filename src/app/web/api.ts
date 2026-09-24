/**
 * Dedicated Web API Layer
 * Ensures the Web frontend communicates cleanly with backend services
 */
import { apiFetch, getApiUrl } from "../../config";

export async function webApiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("X-Platform", "web");
  headers.set("X-Client-Type", "web-browser-app");

  return apiFetch(endpoint, {
    ...options,
    headers,
  });
}

export { getApiUrl };

/**
 * Genera la URL firmada para subida directa a Google Cloud Storage
 */
export async function getGcsSignedUploadUrl(folder: string = "publicaciones", fileType: string = "image/jpeg", fileName?: string) {
  const query = new URLSearchParams({
    folder,
    file_type: fileType,
    ...(fileName ? { file_name: fileName } : {})
  });
  const res = await webApiFetch(`/api/v1/media/upload-url?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Error obteniendo URL firmada: HTTP ${res.status}`);
  }
  return await res.json() as { upload_url: string; public_url: string; file_key: string };
}

/**
 * Sube un archivo DIRECTAMENTE a Google Cloud Storage mediante Signed URL (sin saturar el backend)
 */
export async function uploadDirectToGCS(file: File | Blob, folder: string = "publicaciones", fileType?: string): Promise<{ public_url: string; file_key: string }> {
  const effectiveType = fileType || (file instanceof File ? file.type : "") || "image/jpeg";
  const fileName = file instanceof File ? file.name : undefined;

  // 1. Pedir la Signed URL al Backend
  const { upload_url, public_url, file_key } = await getGcsSignedUploadUrl(folder, effectiveType, fileName);

  // 2. Subir el archivo DIRECTO a Google Cloud Storage con PUT
  const uploadResult = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": effectiveType,
    },
    body: file,
  });

  if (!uploadResult.ok) {
    throw new Error(`Error subiendo archivo a Google Cloud Storage (HTTP ${uploadResult.status}). Verifica el CORS del bucket.`);
  }

  return { public_url, file_key };
}

/**
 * Flujo completo estándar recomendado:
 * 1. Pide URL firmada
 * 2. PUT directo a GCS
 * 3. POST /api/v1/posts para guardar en MongoDB
 */
export async function subirPublicacion(file: File | Blob, fileType: string, caption: string, extra?: { creatorId?: string; creatorUsername?: string }) {
  try {
    // 1 & 2. Subida directa a Google Cloud Storage
    const { public_url } = await uploadDirectToGCS(file, "publicaciones", fileType);

    // 3. Guardar la URL en MongoDB enviándola al endpoint de publicaciones
    const postResponse = await webApiFetch("/api/v1/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: caption,
        media_url: public_url,
        media_type: fileType.startsWith("video") ? "video" : "image",
        ...extra
      }),
    });

    if (!postResponse.ok) {
      throw new Error(`Error guardando publicación en MongoDB: HTTP ${postResponse.status}`);
    }

    return await postResponse.json();
  } catch (error) {
    console.error("Error en el flujo de publicación:", error);
    throw error;
  }
}

/**
 * Consulta el feed de publicaciones desde MongoDB
 */
export async function getFeedPosts(limit: number = 20) {
  const res = await webApiFetch(`/api/v1/feed?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Error al obtener feed: HTTP ${res.status}`);
  }
  return await res.json() as { posts: any[] };
}
