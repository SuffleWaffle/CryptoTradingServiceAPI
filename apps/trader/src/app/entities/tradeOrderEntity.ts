// import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
// import { BaseEntity } from '@cupo/backend/storage';
// import { OPERATION_TYPE, ORDER_STATUS } from '@cupo/backend/common';
//
// @Entity({ name: 'trading_order', schema: 'public' })
// export class TradeOrderEntity extends BaseEntity {
//   @PrimaryGeneratedColumn('uuid')
//   id?: string;
//
//   // @PrimaryGeneratedColumn('increment', { type: 'bigint' })
//   // id?: number;
//
//   @Column({ type: 'varchar', length: 48 })
//   userId: string;
//
//   @Column({ type: 'varchar' })
//   exchangeId: string;
//
//   @Column({ type: 'varchar' })
//   symbol: string;
//
//   @Column({ type: 'timestamp' })
//   openTime: Date;
//
//   @Column({ type: 'timestamp', default: () => 'to_timestamp(0)' })
//   closeTime?: Date;
//
//   @Column({ type: 'varchar', length: 34 })
//   type: OPERATION_TYPE;
//
//   @Column({ type: 'varchar', default: ORDER_STATUS.OPENED })
//   status?: ORDER_STATUS;
//
//   @Column({ type: 'bool', default: false })
//   isVirtual?: boolean;
//
//   @Column({ type: 'float8' })
//   volume: number;
//
//   @Column({ type: 'float8' })
//   openPrice: number;
//
//   @Column({ type: 'float8', default: 0 })
//   closePrice?: number;
//
//   @Column({ type: 'float8', default: 0 })
//   stopLoss?: number;
//
//   @Column({ type: 'float8', default: 0 })
//   takeProfit?: number;
//
//   @Column({ type: 'float8', default: 0 })
//   swap?: number;
//
//   @Column({ type: 'float8', default: 0 })
//   commission?: number;
//
//   @Column({ type: 'float8', default: 0 })
//   tax?: number;
//
//   @Column({ type: 'float8', default: 0 })
//   profit?: number;
//
//   @Column({ type: 'varchar', length: 300, nullable: true })
//   commentClose?: string;
// }
