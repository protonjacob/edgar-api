export interface ApiError {
  message: string;
  status: number;
}

/**
 * Envelope used for every response returned by the API, successful or not.
 * `status` always mirrors the HTTP status code of the response.
 */
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  status: number;
}
