export interface IGetListDto {
  _id?: string; // mongo db
  deleted?: boolean;
  created?: Date;
  updated?: Date;
  page?: number;
  itemsPerPage?: number;
  sort?: string;
  sortOrder?: number;
}
