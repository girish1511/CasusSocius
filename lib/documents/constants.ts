export const DOCUMENTS_BUCKET = "documents";

// Keep upload sizes sane so extraction never has to hold something huge in
// memory at once (personal-app scale, not a general-purpose file host).
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
