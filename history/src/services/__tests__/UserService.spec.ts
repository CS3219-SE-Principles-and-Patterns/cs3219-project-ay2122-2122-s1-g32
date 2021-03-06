import prisma from 'lib/prisma';
import userService from 'services/UserService';
import { AuthorizationError, InvalidDataError } from 'types/error';
import { botUser } from 'utils/botUser';
import { Fixtures, loadFixtures } from 'utils/fixtures';
import { createTestUser, mockTestUser } from 'utils/tests';

let fixtures: Fixtures;

beforeAll(async () => {
  fixtures = await loadFixtures();
});

afterAll(async () => {
  await fixtures.tearDown();
});

describe('UserService', () => {
  let id: string;
  let githubUsername: string;
  let photoUrl: string;
  let profileUrl: string;

  describe('create', () => {
    beforeEach(async () => {
      await fixtures.reload();
      const mockUserData = mockTestUser();
      id = mockUserData.id;
      githubUsername = mockUserData.githubUsername;
      photoUrl = mockUserData.photoUrl;
      profileUrl = mockUserData.profileUrl;
    });

    it('creates a user', async () => {
      const user = await userService.create(
        {
          id,
          githubUsername,
          photoUrl,
          profileUrl,
        },
        botUser,
      );
      expect(user.id).toBe(id);
      expect(user.githubUsername).toBe(githubUsername);
      expect(await prisma.user.findUnique({ where: { id } })).toBeTruthy();
    });

    it('checks for id length', async () => {
      await expect(
        userService.create(
          {
            id: '',
            githubUsername,
            photoUrl,
            profileUrl,
          },
          botUser,
        ),
      ).rejects.toThrow(InvalidDataError);
    });

    it('checks for github username length', async () => {
      await expect(
        userService.create(
          {
            id,
            githubUsername: '',
            photoUrl,
            profileUrl,
          },
          botUser,
        ),
      ).rejects.toThrow(InvalidDataError);
    });

    it('checks for photo url length', async () => {
      await expect(
        userService.create(
          {
            id,
            githubUsername,
            photoUrl: '',
            profileUrl,
          },
          botUser,
        ),
      ).rejects.toThrow(InvalidDataError);
    });

    it('checks for profile url length', async () => {
      await expect(
        userService.create(
          {
            id,
            githubUsername,
            photoUrl,
            profileUrl: '',
          },
          botUser,
        ),
      ).rejects.toThrow(InvalidDataError);
    });

    it('prevents non-bots from creating users', async () => {
      const nonBotUser = await createTestUser();
      await expect(
        userService.create(
          {
            id,
            githubUsername,
            photoUrl,
            profileUrl,
          },
          nonBotUser,
        ),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('read', () => {
    it('user can read themselves', async () => {
      const user = await userService.read(
        fixtures.userOne.id,
        fixtures.userOne,
      );
      expect(user).toEqual(fixtures.userOne);
    });

    it('unrelated user cannot read another user', async () => {
      await expect(
        userService.read(fixtures.userOne.id, fixtures.userTwo),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await fixtures.reload();
      const mockUserData = mockTestUser();
      id = mockUserData.id;
      githubUsername = mockUserData.githubUsername;
      photoUrl = mockUserData.photoUrl;
      profileUrl = mockUserData.profileUrl;
    });

    it('user can update themselves', async () => {
      const updatedUser = await userService.update(
        fixtures.userOne.id,
        {
          githubUsername,
          photoUrl,
          profileUrl,
        },
        fixtures.userOne,
      );
      expect(updatedUser.id).toBe(fixtures.userOne.id);
      expect(updatedUser.githubUsername).toBe(githubUsername);
      expect(updatedUser.photoUrl).toBe(photoUrl);
      expect(updatedUser.profileUrl).toBe(profileUrl);
    });

    it('unrelated user cannot update another user', async () => {
      await expect(
        userService.update(
          fixtures.userOne.id,
          {
            githubUsername,
          },
          fixtures.userTwo,
        ),
      ).rejects.toThrow(AuthorizationError);
    });

    it('checks for github username length', async () => {
      await expect(
        userService.update(
          fixtures.userOne.id,
          {
            githubUsername: '',
          },
          fixtures.userOne,
        ),
      ).rejects.toThrow(InvalidDataError);
    });

    it('checks for photo url length', async () => {
      await expect(
        userService.update(
          fixtures.userOne.id,
          {
            photoUrl: '',
          },
          fixtures.userOne,
        ),
      ).rejects.toThrow(InvalidDataError);
    });

    it('checks for profile url length', async () => {
      await expect(
        userService.update(
          fixtures.userOne.id,
          {
            profileUrl: '',
          },
          fixtures.userOne,
        ),
      ).rejects.toThrow(InvalidDataError);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await fixtures.reload();
    });

    it('user can delete themselves', async () => {
      await userService.delete(fixtures.userOne.id, fixtures.userOne);
      const deletedUser = await prisma.user.findUnique({
        where: { id: fixtures.userOne.id },
      });
      expect(deletedUser).toBeNull();
    });

    it('unrelated user cannot delete another user', async () => {
      await expect(
        userService.delete(fixtures.userOne.id, fixtures.userTwo),
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
