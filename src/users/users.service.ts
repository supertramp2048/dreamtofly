import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DataSource, ILike } from 'typeorm';
import { QueueAction } from 'rxjs/internal/scheduler/QueueAction';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt'
import { PageDto } from 'src/common/pagination/dto/page.dto';
import { AccStatus } from './enum/accStatus.enum';
import { PageOptionsDto } from 'src/common/pagination/dto/pageOption.dto';
import { PageMetaDto } from 'src/common/pagination/dto/pageMeta.dto';
import { paginate } from 'src/common/pagination/helper/pagination.helper';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) { }
  async create(createUserDto: CreateUserDto) {
    try {
      const hashPassword = await bcrypt.hash(createUserDto.password, 10)
      createUserDto.password = hashPassword;
      return {
        data: await this.usersRepository.save(createUserDto)
      }
    } catch (error) {
      throw new UnprocessableEntityException({
        message: 'Email has been ussed',
        code: 'EMAIL_MUST_BE_UNIQUE'
      })
    }
  }

  async findAll(
    pageOptionsDto: PageOptionsDto,
  ) {
    const queryBuilder = this.usersRepository.createQueryBuilder('User')
    return paginate(queryBuilder,pageOptionsDto,"User")
  }

  async findOne(id: string) {
    return { data: await this.usersRepository.findOneBy({ id }) }
  }
  async findOneByEmail(email: string) {
    return { data: await this.usersRepository.findOneBy({ email }) }
  }

  async findByName(name: string, currentUid: string) {
    // return {
    //   data: await this.usersRepository.find({
    //     where: { name: ILike(`%${name}%`) },
    //   }),
    // };
    const res = await this.usersRepository
      .createQueryBuilder('u')
      .where('u.id <> :id', { id: currentUid })
      .andWhere('u.name ILike :name', { name: `%${name}%` })
      .getMany();

    return { data: res };
  }
  async update(id: string, updateUserDto: UpdateUserDto) {
    return { data: await this.usersRepository.update({ id: id }, updateUserDto) };

  }

  async remove(id: string) {
    return {
      data: await this.usersRepository.update(
        { id: id },
        {
          status: AccStatus.DELETED
        })
    };
  }
}
