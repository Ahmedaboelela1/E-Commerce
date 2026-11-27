import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductDetails1795780800000 implements MigrationInterface {
    async up(runner: QueryRunner) {
        await runner.query(
            'ALTER TABLE product ADD customFieldsDetailsen longtext NULL, ADD customFieldsDetailsar longtext NULL',
        );
    }

    async down(runner: QueryRunner) {
        await runner.query(
            'ALTER TABLE product DROP COLUMN customFieldsDetailsen, DROP COLUMN customFieldsDetailsar',
        );
    }
}
