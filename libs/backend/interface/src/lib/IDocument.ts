import { ObjectId } from 'mongodb';

export interface IDocument {
  _id?: string | ObjectId;
  created?: Date;
  updated?: Date;
  deleted?: boolean;
}
