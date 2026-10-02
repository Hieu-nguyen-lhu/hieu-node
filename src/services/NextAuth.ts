import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import InitializeDatabase, { AppDataSource } from "@/database/dataSource";
import { User as UserEntity } from "@/database/entity/User.entity";
import { Profile as ProfileEntity } from "@/database/entity/Profile.entity";
import bcrypt from "bcrypt";
import z from "zod";
import type { Awaitable, NextAuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

export const NEXT_AUTH: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "Email",
        },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Password",
        },
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }

        const credentialsSchema = z
          .object({
            email: z.string().trim().email({ message: "Invalid Email" }),
            password: z.string().trim(),
          })
          .passthrough();

        try {
          credentialsSchema.parse(credentials);
        } catch (error) {
          return null;
        }

        const { email, password } = credentials;

        await InitializeDatabase();

        const user = await AppDataSource.getRepository(UserEntity).findOne({
          where: { email },
          relations: ["additionalInformation"],
        });

        if (!user || !user.isSignedIn) {
          return null;
        }

        if (!(await bcrypt.compare(password, user.password))) return null;

        return {
          id: user.id,
          email: user.email,
          accountType: user.accountType,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      async profile(profile) {
        await InitializeDatabase();

        const user = await AppDataSource.getRepository(UserEntity).findOne({
          where: { email: profile.email },
          relations: ["additionalInformation"],
        });

        if (user) {
          return {
            id: user.id,
            email: user.email,
            accountType: user.accountType,
          } as Awaitable<User>;
        }
        return {
          id: profile.sub || profile.id,
          email: profile.email,
          accountType: "Student",
        } as Awaitable<User>;
      },
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      async profile(profile) {
        await InitializeDatabase();

        const email = profile.email || `${profile.login}@users.noreply.github.com`;

        const user = await AppDataSource.getRepository(UserEntity).findOne({
          where: { email },
          relations: ["additionalInformation"],
        });

        if (user) {
          return {
            id: user.id,
            email: user.email,
            accountType: user.accountType,
          } as Awaitable<User>;
        }

        return {
          id: String(profile.id),
          name: profile.name || profile.login,
          email: email,
          image: profile.avatar_url,
          accountType: "Student",
        } as Awaitable<User>;
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET!,
  pages: {
    signIn: "/auth/login",
    signOut: "/dashboard/my-profile",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          await InitializeDatabase();
          const userRepo = AppDataSource.getRepository(UserEntity);
          const email = user.email || (profile as any)?.email || `${(profile as any)?.login}@users.noreply.github.com`;

          let existingUser = await userRepo.findOne({
            where: { email },
          });

          if (!existingUser) {
            existingUser = new UserEntity();
            existingUser.email = email;
            existingUser.firstName = (profile as any)?.given_name || user.name?.split(" ")[0] || (profile as any)?.login || "GitHub";
            existingUser.lastName = (profile as any)?.family_name || user.name?.split(" ")[1] || "User";
            existingUser.contactNumber = "0000000000";
            existingUser.image = user.image || (profile as any)?.picture || (profile as any)?.avatar_url || "";
            existingUser.password = "";
            existingUser.isSignedIn = true;
            existingUser.accountType = "Student" as any;
            await userRepo.save(existingUser);

            const profileRepo = AppDataSource.getRepository(ProfileEntity);
            const newProfile = new ProfileEntity();
            newProfile.user = existingUser;
            await profileRepo.save(newProfile);
          } else {
            existingUser.isSignedIn = true;
            if (user.image && !existingUser.image) {
              existingUser.image = user.image;
            }
            await userRepo.save(existingUser);
          }
        } catch (e) {
          console.error("Error auto-creating oauth user:", e);
        }
      }
      return true;
    },
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        token.accountType = user.accountType;
        token.email = user.email;
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.user.id = token.id;
      session.user.accountType = token.accountType;
      session.user.email = token.email;

      return session;
    },
  },
};
