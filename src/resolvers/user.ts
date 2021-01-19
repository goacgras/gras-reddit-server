import { User } from "../entities/User";
import { MyContext } from "../../src/types";
import {
    Arg,
    Resolver,
    Mutation,
    InputType,
    Field,
    Ctx,
    ObjectType,
} from "type-graphql";
import argon2 from "argon2";

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string;
    @Field()
    password: string;
}

@ObjectType()
class FieldError {
    @Field()
    field: string;
    @Field()
    message: string;
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], { nullable: true })
    errors?: FieldError[];

    @Field(() => User, { nullable: true })
    user?: User;
}

@Resolver()
export class UserResolver {
    @Mutation(() => UserResponse)
    async register(
        @Arg("userData") userData: UsernamePasswordInput,
        @Ctx() { em }: MyContext
    ): Promise<UserResponse> {
        if (userData.username.length <= 2) {
            return {
                errors: [
                    {
                        field: "username",
                        message: "username must be at least 2 character",
                    },
                ],
            };
        }
        if (userData.password.length <= 3) {
            return {
                errors: [
                    {
                        field: "password",
                        message: "username must be at least 3 character",
                    },
                ],
            };
        }

        const hashedPassword = await argon2.hash(userData.password);
        const user = em.create(User, {
            username: userData.username,
            password: hashedPassword,
        });
        try {
            await em.persistAndFlush(user);
            return {
                user,
            };
        } catch (err) {
            //duplicate username error
            if (err.code === "23505" || err.detail.includes("already exists")) {
                return {
                    errors: [
                        {
                            field: "username",
                            message: "Username already exist",
                        },
                    ],
                };
            }

            return {
                errors: [
                    {
                        field: "general",
                        message: "Something went wrong",
                    },
                ],
            };
        }
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg("userData") userData: UsernamePasswordInput,
        @Ctx() { em }: MyContext
    ): Promise<UserResponse> {
        const user = await em.findOne(User, {
            username: userData.username,
        });
        if (!user) {
            return {
                errors: [
                    {
                        field: "username",
                        message: "User not found",
                    },
                ],
            };
        }

        const validPassword = await argon2.verify(
            user.password,
            userData.password
        );
        if (!validPassword) {
            return {
                errors: [
                    {
                        field: "password",
                        message: "Wrong Password",
                    },
                ],
            };
        }

        return {
            user,
        };
    }
}