export interface DriveUserInfo {
  displayName?: string | null;
  emailAddress?: string | null;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  owners?: DriveUserInfo[];
  isFolder: boolean;
}

export interface ListDriveFilesResponse {
  files: DriveFile[];
  nextPageToken: string | null;
  parentId: string | null;
  driveId: string | null;
}


