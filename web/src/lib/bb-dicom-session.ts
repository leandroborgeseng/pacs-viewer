/** Cookie só no domínio do portal; não exposto ao JavaScript (httpOnly). O proxy /bb-api lê-no e põe Bearer na API Nest. */
export const BB_DICOM_PROXY_COOKIE = "bb_dicom_proxy_session";
