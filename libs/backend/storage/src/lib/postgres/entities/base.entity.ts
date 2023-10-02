//
// export abstract class BaseEntity {
//   @Column({ type: 'boolean', nullable: true })
//   isArchived?: boolean;
//
//   @Column({ type: 'boolean', nullable: true })
//   isDeleted?: boolean;
//
//   @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
//   created?: Date;
//
//   @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
//   updated?: Date;
//
//   @Column({ type: 'varchar', length: 300, nullable: true })
//   comment?: string | null;
//
//   @Column({ type: 'varchar' })
//   client?: string;
// }
