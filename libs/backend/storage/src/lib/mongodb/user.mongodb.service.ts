import { Injectable } from '@nestjs/common';
import { BulkWriteResult, Sort, UpdateResult } from 'mongodb';
import { IGetAllUsers, QueueParamsUpdateBalances, User, UserAccountBalance } from '@cupo/backend/interface';
import { CollectionNames } from './collections';
import { MongodbService } from './mongodb.service';

@Injectable()
export class UserMongodbService extends MongodbService {
  async getAllUsers(params: IGetAllUsers): Promise<{ users: User[]; totalItems: number }> {
    const { userId, userIds, active, emailVerified, adminApproved } = params;

    const query = {};

    if (userIds?.length) {
      query['id'] = { $in: userIds };
    } else if (userId) {
      query['id'] = userId;
    }

    if (active !== undefined) {
      query['active'] = active;
    }
    if (emailVerified !== undefined) {
      query['emailVerified'] = emailVerified;
    }
    if (adminApproved !== undefined) {
      query['adminApproved'] = adminApproved;
    }

    let users = [];
    const totalItems = await this.count(CollectionNames.Users, query);

    if (totalItems > 0) {
      const page = Math.max(params.page || 1, 1) - 1;
      const limit = Math.min(Math.max(params.itemsPerPage || 25, 1), 100);

      const sortField: string = params.sort || 'created';
      const sortDirection: number = params.sortOrder || -1;
      const sort = sortField
        ? ({ [sortField]: sortDirection } as Sort)
        : ({
            updated: sortDirection,
          } as Sort);

      // console.log('sort', sort, query);

      users = await this.find<User>(CollectionNames.Users, query, {
        sort,
        skip: page * limit,
        limit,
      });
    }

    return { users, totalItems };
  }

  async updateUserWallet(balances: QueueParamsUpdateBalances): Promise<boolean> {
    const { userId, exchangeId, ...rest } = balances;
    const result: UpdateResult = await this.upsertOne<UserAccountBalance>(
      CollectionNames.WalletBalances,
      { userId, exchangeId },
      {
        ...(rest || {}),
        updated: Date.now(),
      }
    );

    return result.acknowledged;
  }

  async getUserWallet(params: { userId: string; exchangeId: string }): Promise<QueueParamsUpdateBalances | null> {
    return this.findOne<QueueParamsUpdateBalances>(CollectionNames.WalletBalances, params);
  }

  async collectUsers(users: User[]): Promise<BulkWriteResult> {
    return this.updateManyWithBulkWrite(
      CollectionNames.Users,
      users.map((user) => {
        return {
          filter: { id: user.id },
          replacement: { ...user },
        };
      })
    );
  }
}
