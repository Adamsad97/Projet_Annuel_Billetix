import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { RpcException } from "@nestjs/microservices";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { REDIS_CLIENT } from "../redis/redis.module";
import {
  OAuthProvider,
  TwoFactorMethod,
  User,
  UserRole,
} from "../user/user.entity";
import { AuthService, isPasswordExpired } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";
import { PlatformConfigCache } from "../platform-config/platform-config.cache";

describe("AuthService", () => {
  let service: AuthService;
  let queryBuilder: {
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getOne: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let repo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    findBy: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
  };
  let twoFactorService: {
    verifyTotp: jest.Mock;
    verify: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock; decode: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let platformConfig: { get: jest.Mock };

  const baseUser: Partial<User> = {
    id: "user-1",
    email: "jean@example.com",
    birth_date: "1990-01-15",
    password_hash: null,
    is_active: true,
    is_suspended: false,
    is_email_verified: true,
    two_factor_enabled: false,
    role: UserRole.BUYER,
  };

  beforeEach(async () => {
    queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getManyAndCount: jest.fn(),
    };
    twoFactorService = {
      verifyTotp: jest.fn(),
      verify: jest.fn(),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
      findBy: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue("signed-token"),
      verify: jest.fn(),
      decode: jest.fn().mockReturnValue({ jti: "jti-2" }),
    };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    platformConfig = {
      get: jest.fn().mockResolvedValue({
        password_min_length: 12,
        minimum_signup_age: 18,
        session_idle_timeout_minutes: 30,
        session_max_duration_hours: 12,
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: repo,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: REDIS_CLIENT,
          useValue: redis,
        },
        { provide: "NOTIFICATION_SERVICE", useValue: { emit: jest.fn() } },
        {
          provide: "ADMIN_SERVICE",
          useValue: { send: jest.fn().mockReturnValue({ subscribe: jest.fn() }) },
        },
        {
          provide: PlatformConfigCache,
          useValue: platformConfig,
        },
        { provide: TwoFactorService, useValue: twoFactorService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // register() ne connecte plus : un compte non vérifié doit d'abord valider son email (CDC §2.2).
  describe("register", () => {
    it("ne renvoie aucun token — le compte doit être vérifié avant tout accès", async () => {
      repo.findOne.mockResolvedValue(null); // email disponible
      repo.create.mockImplementation((data) => ({ id: "new-user", ...data }));
      repo.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.register({
        email: "nouveau@example.com",
        password: "MotDePasse123!",
        first_name: "Nouveau",
        last_name: "Compte",
        birth_date: "1998-05-12",
      } as any);

      expect(result).not.toHaveProperty("access_token");
      expect(result).not.toHaveProperty("refresh_token");
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ email_verification_required: true }),
      );
    });

    it("rejette si l'email est déjà utilisé", async () => {
      repo.findOne.mockResolvedValue({ ...baseUser });

      await expect(
        service.register({
          email: "jean@example.com",
          password: "MotDePasse123!",
          first_name: "Jean",
          last_name: "Dupont",
        } as any),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("rejette un email inconnu", async () => {
      queryBuilder.getOne.mockResolvedValue(null);
      await expect(
        service.login({ email: "x@x.com", password: "pw" }),
      ).rejects.toThrow(RpcException);
    });

    it("rejette un compte suspendu", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        is_suspended: true,
      });
      await expect(
        service.login({ email: baseUser.email!, password: "pw" }),
      ).rejects.toThrow(RpcException);
    });

    it("rejette un mot de passe invalide", async () => {
      const hash = await bcrypt.hash("bon-mot-de-passe", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
      });
      await expect(
        service.login({
          email: baseUser.email!,
          password: "mauvais-mot-de-passe",
        }),
      ).rejects.toThrow(RpcException);
    });

    it("retourne les tokens quand la 2FA est désactivée", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: false,
      });

      const result = await service.login({
        email: baseUser.email!,
        password: "pw",
      });

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(twoFactorService.verify).not.toHaveBeenCalled();
    });

    it("demande le code 2FA sans délivrer de tokens quand la 2FA TOTP est activée et aucun code fourni", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });

      const result = await service.login({
        email: baseUser.email!,
        password: "pw",
      });

      expect(result).toEqual({
        requires_2fa: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });
      expect(twoFactorService.verify).not.toHaveBeenCalled();
    });

    it("rejette un code 2FA invalide", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });
      twoFactorService.verify.mockResolvedValue(false);

      await expect(
        service.login({
          email: baseUser.email!,
          password: "pw",
          two_factor_code: "000000",
        }),
      ).rejects.toThrow(RpcException);
    });

    it("délivre les tokens avec un code 2FA valide", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });
      twoFactorService.verify.mockResolvedValue(true);

      const result = await service.login({
        email: baseUser.email!,
        password: "pw",
        two_factor_code: "123456",
      });

      expect(result).toHaveProperty("access_token");
      expect(twoFactorService.verify).toHaveBeenCalledWith(
        "user-1",
        "123456",
      );
    });
  });

  describe("oauthLogin", () => {
    it("rejette une connexion OAuth sans email (évite une collision sur chaîne vide et la violation de contrainte unique)", async () => {
      await expect(
        service.oauthLogin({
          provider: OAuthProvider.FACEBOOK,
          oauth_id: "fb-123",
          email: "",
          first_name: "Jean",
          last_name: "Dupont",
        }),
      ).rejects.toThrow(RpcException);
    });

    // La 2FA est aussi exigée lors d'une connexion OAuth.
    it("ne délivre pas de tokens si la 2FA est activée, renvoie un pending_token à la place", async () => {
      repo.findOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });

      const result = await service.oauthLogin({
        provider: OAuthProvider.GOOGLE,
        oauth_id: "g-123",
        email: baseUser.email!,
        first_name: "Jean",
        last_name: "Dupont",
      });

      expect(result).toEqual({
        requires_2fa: true,
        two_factor_method: TwoFactorMethod.TOTP,
        pending_token: expect.any(String),
      });
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^oauth_2fa_pending:/),
        "user-1",
        "EX",
        expect.any(Number),
      );
    });
  });

  describe("âge minimum via Google/Facebook — date de naissance exigée", () => {
    const googleProfile = {
      provider: OAuthProvider.GOOGLE,
      oauth_id: "g-new",
      email: "nouveau.google@example.com",
      first_name: "Lina",
      last_name: "Nouvelle",
    };
    const yearsAgo = (years: number) => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - years);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    it("ne crée aucun compte à la première connexion : date de naissance demandée d'abord", async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.oauthLogin(googleProfile);

      expect(result).toEqual({
        requires_birth_date: true,
        pending_token: expect.any(String),
        first_name: "Lina",
      });
      expect(repo.save).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it("demande aussi la date à un compte existant qui n'en a pas", async () => {
      repo.findOne.mockResolvedValue({ ...baseUser, birth_date: null });

      const result = await service.oauthLogin({ ...googleProfile, email: baseUser.email! });

      expect(result).toEqual(expect.objectContaining({ requires_birth_date: true }));
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it("refuse un mineur : aucun compte créé, aucun token", async () => {
      redis.get.mockResolvedValue(JSON.stringify({ profile: googleProfile }));

      await expect(
        service.completeOAuthBirthDate("tok", yearsAgo(16)),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it("crée le compte avec sa date de naissance puis connecte une personne majeure", async () => {
      redis.get.mockResolvedValue(JSON.stringify({ profile: googleProfile }));
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((data) => ({ id: "new-user", is_active: true, ...data }));
      repo.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.completeOAuthBirthDate("tok", "1995-03-20");

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: googleProfile.email, birth_date: "1995-03-20" }),
      );
      expect(result).toHaveProperty("access_token");
      expect(redis.del).toHaveBeenCalledWith("oauth_birth_date_pending:tok");
    });

    it("rejette un pending_token inconnu ou expiré", async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.completeOAuthBirthDate("expire", "1995-03-20")).rejects.toThrow(RpcException);
    });
  });

  describe("verifyOauth2fa — second temps du login OAuth quand la 2FA est activée", () => {
    it("rejette si le pending_token est expiré ou inconnu", async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.verifyOauth2fa("tok-expire", "123456")).rejects.toThrow(RpcException);
      expect(twoFactorService.verify).not.toHaveBeenCalled();
    });

    it("rejette un code 2FA invalide", async () => {
      redis.get.mockResolvedValue("user-1");
      repo.findOne.mockResolvedValue({ ...baseUser, two_factor_enabled: true });
      twoFactorService.verify.mockResolvedValue(false);

      await expect(service.verifyOauth2fa("tok-valide", "000000")).rejects.toThrow(RpcException);
      // Usage unique : supprimé même en cas d'échec, pas de réutilisation du pending_token.
      expect(redis.del).toHaveBeenCalledWith("oauth_2fa_pending:tok-valide");
    });

    it("délivre les tokens avec un code 2FA valide", async () => {
      redis.get.mockResolvedValue("user-1");
      repo.findOne.mockResolvedValue({ ...baseUser, two_factor_enabled: true });
      twoFactorService.verify.mockResolvedValue(true);

      const result = await service.verifyOauth2fa("tok-valide", "123456");

      expect(result).toHaveProperty("access_token");
      expect(twoFactorService.verify).toHaveBeenCalledWith("user-1", "123456");
    });
  });

  describe("listUsers", () => {
    it("exclut toujours les comptes déjà supprimés (RGPD) des résultats de recherche", async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[baseUser], 1]);

      await service.listUsers({});

      expect(queryBuilder.where).toHaveBeenCalledWith("u.deleted_at IS NULL");
    });

    it("plafonne la limite à 100 même si une valeur plus grande est demandée", async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listUsers({ limit: 500 });

      expect(queryBuilder.take).toHaveBeenCalledWith(100);
    });

    it("retourne les résultats sans exposer password_hash (sanitize)", async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([
        [{ ...baseUser, password_hash: "secret-hash" }],
        1,
      ]);

      const result = await service.listUsers({ q: "jean" });

      expect(result.total).toBe(1);
      expect(result.data[0]).not.toHaveProperty("password_hash");
    });
  });

  describe("deleteAccount — droit à l'effacement RGPD", () => {
    it("rejette sans mot de passe quand le compte en a un", async () => {
      queryBuilder.getOne.mockResolvedValue({
        id: "user-1",
        password_hash: "some-hash",
      });

      await expect(service.deleteAccount("user-1")).rejects.toThrow(
        RpcException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rejette avec un mot de passe incorrect", async () => {
      const hash = await bcrypt.hash("bon-mot-de-passe", 4);
      queryBuilder.getOne.mockResolvedValue({ id: "user-1", password_hash: hash });

      await expect(
        service.deleteAccount("user-1", "mauvais-mot-de-passe"),
      ).rejects.toThrow(RpcException);
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it("anonymise le compte et pose le soft-delete avec le bon mot de passe", async () => {
      const hash = await bcrypt.hash("bon-mot-de-passe", 4);
      queryBuilder.getOne.mockResolvedValue({ id: "user-1", password_hash: hash });

      const result = await service.deleteAccount("user-1", "bon-mot-de-passe");

      expect(result).toEqual({ success: true });
      expect(repo.update).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          email: "deleted-user-1@billetix.invalid",
          phone: null,
          password_hash: null,
          two_factor_enabled: false,
          is_active: false,
        }),
      );
      expect(repo.softDelete).toHaveBeenCalledWith("user-1");
    });

    it("ne demande aucun mot de passe pour un compte OAuth (sans password_hash)", async () => {
      queryBuilder.getOne.mockResolvedValue({ id: "user-2", password_hash: null });

      const result = await service.deleteAccount("user-2");

      expect(result).toEqual({ success: true });
      expect(repo.softDelete).toHaveBeenCalledWith("user-2");
    });
  });

  describe("refresh — rotation du refresh token", () => {
    it("rejette un refresh token dont la signature est invalide", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("invalid signature");
      });

      await expect(service.refresh({ refresh_token: "forge" })).rejects.toThrow(RpcException);
    });

    it("rejette un refresh token révoqué (blacklisté), avec un code explicite", async () => {
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-1", exp: 9999999999 });
      redis.get.mockImplementation((key: string) => Promise.resolve(key.startsWith("blacklist:") ? "1" : null));

      await expect(service.refresh({ refresh_token: "token" })).rejects.toMatchObject({
        error: { code: "REFRESH_REVOKED" },
      });
    });

    it("plusieurs onglets : le même jeton présenté juste après sa rotation renvoie la même nouvelle session", async () => {
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-1", exp: 9999999999 });
      const pair = { access_token: "access-2", refresh_token: "refresh-2" };
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key === "rotated:jti-1" ? JSON.stringify(pair) : key === "blacklist:jti-1" ? "1" : null),
      );

      await expect(service.refresh({ refresh_token: "token" })).resolves.toEqual(pair);
    });

    it("après déconnexion de la nouvelle session, l'ancien jeton ne la rouvre pas pendant le délai de grâce", async () => {
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-1", exp: 9999999999 });
      const pair = { access_token: "access-2", refresh_token: "refresh-2" };
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(key === "rotated:jti-1" ? JSON.stringify(pair) : key === "blacklist:jti-2" ? "1" : null),
      );

      await expect(service.refresh({ refresh_token: "token" })).rejects.toMatchObject({
        error: { code: "REFRESH_REVOKED" },
      });
    });

    it("mémorise la nouvelle paire pendant le délai de grâce réglé par l'admin", async () => {
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-1", exp: 9999999999 });
      redis.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ ...baseUser, is_active: true, is_suspended: false });
      platformConfig.get.mockResolvedValue({
        session_idle_timeout_minutes: 30,
        session_max_duration_hours: 12,
        session_refresh_grace_seconds: 45,
      });

      const result = await service.refresh({ refresh_token: "token" });

      expect(redis.set).toHaveBeenCalledWith("rotated:jti-1", JSON.stringify(result), "EX", 45);
    });

    it("révoque l'ancien refresh token et en émet un nouveau (rotation)", async () => {
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-1", exp: 9999999999 });
      redis.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ ...baseUser, is_active: true, is_suspended: false });

      const result = await service.refresh({ refresh_token: "token" });

      expect(redis.set).toHaveBeenCalledWith("blacklist:jti-1", "1", "EX", expect.any(Number));
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
    });

    it("rejette si l'utilisateur est suspendu", async () => {
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-1", exp: 9999999999 });
      redis.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ ...baseUser, is_active: true, is_suspended: true });

      await expect(service.refresh({ refresh_token: "token" })).rejects.toThrow(RpcException);
    });
  });

  describe("refresh — expiration pour inactivité (platform_settings)", () => {
    const refreshIssuedMinutesAgo = (minutes: number) => {
      const now = Math.floor(Date.now() / 1000);
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-idle", iat: now - minutes * 60, exp: now + 3600 });
      redis.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ ...baseUser });
    };

    it("renouvelle une session active (dernier rafraîchissement récent)", async () => {
      refreshIssuedMinutesAgo(10);
      await expect(service.refresh({ refresh_token: "rt" })).resolves.toHaveProperty("access_token");
    });

    it("refuse et révoque une session inactive depuis plus que le délai", async () => {
      refreshIssuedMinutesAgo(31);
      await expect(service.refresh({ refresh_token: "rt" })).rejects.toThrow(RpcException);
      expect(redis.set).toHaveBeenCalledWith("blacklist:jti-idle", "1", "EX", expect.any(Number));
    });

    it("jamais une valeur figée dans le code : suit session_idle_timeout_minutes", async () => {
      platformConfig.get.mockResolvedValue({ session_idle_timeout_minutes: 5 });
      refreshIssuedMinutesAgo(10);
      await expect(service.refresh({ refresh_token: "rt" })).rejects.toThrow(RpcException);
    });

    it("expose les durées configurées au frontend", async () => {
      platformConfig.get.mockResolvedValue({ session_idle_timeout_minutes: 45, session_max_duration_hours: 8 });
      await expect(service.getSessionPolicy()).resolves.toEqual({
        idle_timeout_minutes: 45,
        max_duration_hours: 8,
      });
    });

    it("refuse une session active mais connectée depuis plus que la durée maximale", async () => {
      const now = Math.floor(Date.now() / 1000);
      // Rafraîchie il y a 1 min (active), mais connectée il y a 13 h.
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-old", iat: now - 60, auth_time: now - 13 * 3600, exp: now + 3600 });
      redis.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ ...baseUser });

      await expect(service.refresh({ refresh_token: "rt" })).rejects.toThrow(RpcException);
      expect(redis.set).toHaveBeenCalledWith("blacklist:jti-old", "1", "EX", expect.any(Number));
    });

    it("conserve l'heure de connexion d'origine à chaque rotation", async () => {
      const now = Math.floor(Date.now() / 1000);
      const authTime = now - 2 * 3600;
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-2", iat: now - 60, auth_time: authTime, exp: now + 3600 });
      redis.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ ...baseUser });

      await service.refresh({ refresh_token: "rt" });
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ auth_time: authTime }),
        expect.anything(),
      );
    });

    it("recopie l'heure de connexion d'origine dans le jeton d'accès (actions sensibles)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const authTime = now - 2 * 3600;
      jwtService.verify.mockReturnValue({ sub: "user-1", jti: "jti-3", iat: now - 60, auth_time: authTime, exp: now + 3600 });
      redis.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ ...baseUser });

      await service.refresh({ refresh_token: "rt" });
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: baseUser.role, auth_time: authTime }),
        expect.anything(),
      );
    });
  });

  describe("logout — révocation", () => {
    it("ne blackliste rien pour un token forgé (signature non vérifiée jamais faite confiance)", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("invalid signature");
      });

      const result = await service.logout({ refresh_token: "forge" });

      expect(result).toEqual({ success: true });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it("blackliste le jti d'un refresh token valide", async () => {
      jwtService.verify.mockReturnValue({ jti: "jti-1", exp: 9999999999 });

      await service.logout({ refresh_token: "token" });

      expect(redis.set).toHaveBeenCalledWith("blacklist:jti-1", "1", "EX", expect.any(Number));
    });

    it("oublie la paire gardée pour le délai de grâce : un jeton déjà renouvelé puis déconnecté ne sert plus", async () => {
      jwtService.verify.mockReturnValue({ jti: "jti-1", exp: 9999999999 });

      await service.logout({ refresh_token: "token" });

      expect(redis.del).toHaveBeenCalledWith("rotated:jti-1");
    });
  });

  describe("code d'échange OAuth — jamais de JWT en clair dans l'URL", () => {
    it("stocke les tokens sous un code opaque avec une courte durée de vie", async () => {
      const code = await service.createOAuthExchangeCode({
        access_token: "access-1",
        refresh_token: "refresh-1",
      });

      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThanOrEqual(32);
      expect(redis.set).toHaveBeenCalledWith(
        `oauth_exchange:${code}`,
        JSON.stringify({ access_token: "access-1", refresh_token: "refresh-1" }),
        "EX",
        60,
      );
    });

    it("échange un code valide contre les tokens puis le supprime (usage unique)", async () => {
      redis.get.mockResolvedValue(JSON.stringify({ access_token: "a", refresh_token: "r" }));

      const result = await service.exchangeOAuthCode("code-1");

      expect(result).toEqual({ access_token: "a", refresh_token: "r" });
      expect(redis.del).toHaveBeenCalledWith("oauth_exchange:code-1");
    });

    it("rejette un code inconnu ou déjà utilisé", async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.exchangeOAuthCode("code-invalide")).rejects.toThrow(RpcException);
    });
  });

  describe("changePassword — modification depuis le profil", () => {
    it("modifie le mot de passe quand l'ancien mot de passe est correct", async () => {
      const oldHash = await bcrypt.hash("ancien-mdp", 4);
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: oldHash });

      const result = await service.changePassword("user-1", {
        current_password: "ancien-mdp",
        new_password: "Nouveau-Mdp-2026",
      });

      expect(result).toEqual({ success: true });
      expect(repo.save).toHaveBeenCalled();
      const saved = repo.save.mock.calls[0][0];
      expect(await bcrypt.compare("Nouveau-Mdp-2026", saved.password_hash)).toBe(true);
    });

    it("rejette si l'ancien mot de passe est incorrect", async () => {
      const oldHash = await bcrypt.hash("ancien-mdp", 4);
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: oldHash });

      await expect(
        service.changePassword("user-1", {
          current_password: "mauvais-mdp",
          new_password: "Nouveau-Mdp-2026",
        }),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("rejette pour un compte OAuth sans mot de passe existant", async () => {
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: null });

      await expect(
        service.changePassword("user-1", {
          current_password: "peu-importe",
          new_password: "Nouveau-Mdp-2026",
        }),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("rejette un nouveau mot de passe contenant le nom du titulaire", async () => {
      const oldHash = await bcrypt.hash("ancien-mdp", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        first_name: "Jean",
        last_name: "Dupont",
        password_hash: oldHash,
      });

      await expect(
        service.changePassword("user-1", {
          current_password: "ancien-mdp",
          new_password: "Mon-DUPONT-2026!",
        }),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe("renouvellement du mot de passe (CNIL, password_max_age_days)", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

    async function loginWith(user: Partial<User>, config: Record<string, unknown>, twoFactorCode?: string) {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: hash, ...user });
      platformConfig.get.mockResolvedValue({ password_min_length: 12, ...config });
      return service.login({ email: baseUser.email!, password: "pw", ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}) });
    }

    it("exige le changement quand le mot de passe date de plus de 60 jours, sans ouvrir de session", async () => {
      const result = await loginWith({ password_changed_at: daysAgo(61) }, { password_max_age_days: 60 });

      expect(result).toEqual({
        password_expired: true,
        password_change_token: expect.any(String),
        password_max_age_days: 60,
      });
      expect(result).not.toHaveProperty("access_token");
      expect(jwtService.sign).not.toHaveBeenCalled();
      // Lien à usage unique et de courte durée, utilisable par la réinitialisation existante.
      const token = (result as { password_change_token: string }).password_change_token;
      expect(redis.set).toHaveBeenCalledWith(`reset_password:${token}`, "user-1", "EX", 15 * 60);
    });

    it("ouvre la session normalement tant que le mot de passe est récent", async () => {
      const result = await loginWith({ password_changed_at: daysAgo(59) }, { password_max_age_days: 60 });
      expect(result).toHaveProperty("access_token");
    });

    it("jamais une valeur figée : suit le réglage de l'admin, et 0 désactive l'expiration", async () => {
      await expect(loginWith({ password_changed_at: daysAgo(40) }, { password_max_age_days: 30 })).resolves.toHaveProperty("password_expired", true);
      await expect(loginWith({ password_changed_at: daysAgo(400) }, { password_max_age_days: 0 })).resolves.toHaveProperty("access_token");
    });

    it("ne contourne pas la 2FA : le code est demandé avant le changement de mot de passe", async () => {
      const expired = { password_changed_at: daysAgo(90), two_factor_enabled: true, two_factor_method: TwoFactorMethod.TOTP };
      await expect(loginWith(expired, { password_max_age_days: 60 })).resolves.toEqual({
        requires_2fa: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });
      expect(redis.set).not.toHaveBeenCalled();

      twoFactorService.verify.mockResolvedValue(true);
      await expect(loginWith(expired, { password_max_age_days: 60 }, "123456")).resolves.toHaveProperty("password_expired", true);
    });

    it("sans date de changement connue, part de la création du compte", () => {
      expect(isPasswordExpired({ password_changed_at: null, created_at: daysAgo(100) }, 60)).toBe(true);
      expect(isPasswordExpired({ password_changed_at: null, created_at: daysAgo(10) }, 60)).toBe(false);
      expect(isPasswordExpired({}, 60)).toBe(false);
    });

    it("la réinitialisation enregistre la date du changement", async () => {
      redis.get.mockResolvedValue("user-1");
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: await bcrypt.hash("Ancien-Mdp-2025!", 4) });
      repo.save.mockImplementation((user) => Promise.resolve(user));

      await service.resetPassword({ token: "tok", new_password: "Nouveau-Mdp-2026!" });

      const saved = repo.save.mock.calls[0][0];
      expect(saved.password_changed_at).toBeInstanceOf(Date);
      expect(Date.now() - saved.password_changed_at.getTime()).toBeLessThan(5000);
      expect(redis.del).toHaveBeenCalledWith("reset_password:tok");
    });

    it("refuse de reprendre le même mot de passe, à la réinitialisation comme au changement", async () => {
      const hash = await bcrypt.hash("Meme-Mdp-2026!", 4);
      redis.get.mockResolvedValue("user-1");
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: hash });

      await expect(service.resetPassword({ token: "tok", new_password: "Meme-Mdp-2026!" })).rejects.toThrow(
        "Le nouveau mot de passe doit être différent de l'ancien.",
      );
      await expect(
        service.changePassword("user-1", { current_password: "Meme-Mdp-2026!", new_password: "Meme-Mdp-2026!" }),
      ).rejects.toThrow("Le nouveau mot de passe doit être différent de l'ancien.");
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("le changement depuis le profil enregistre aussi la date", async () => {
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: await bcrypt.hash("ancien-mdp", 4) });
      await service.changePassword("user-1", { current_password: "ancien-mdp", new_password: "Nouveau-Mdp-2026" });
      expect(repo.save.mock.calls[0][0].password_changed_at).toBeInstanceOf(Date);
    });
  });

  describe("politique de mot de passe — longueur issue de platform_settings", () => {
    const registerWith = (password: string) =>
      service.register({
        email: "nouveau@example.com",
        password,
        first_name: "Nouveau",
        last_name: "Compte",
        birth_date: "1998-05-12",
      } as any);

    beforeEach(() => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockImplementation((data) => ({ id: "new-user", ...data }));
      repo.save.mockImplementation((user) => Promise.resolve(user));
    });

    it("rejette un mot de passe sans majuscule, chiffre ni caractère spécial", async () => {
      await expect(registerWith("motdepasselong")).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("jamais une valeur figée dans le code : suit password_min_length", async () => {
      // 14 caractères, toutes classes présentes : accepté à 12…
      await expect(registerWith("MotDePasse123!")).resolves.toBeDefined();

      // …refusé dès que l'admin relève le minimum à 16.
      platformConfig.get.mockResolvedValue({ password_min_length: 16, minimum_signup_age: 18 });
      repo.save.mockClear();
      await expect(registerWith("MotDePasse123!")).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    const yearsAgo = (years: number) => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - years);
      // Composantes locales (pas toISOString, en UTC) : même jour que ageInYears().
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const registerBornOn = (birth_date: string) =>
      service.register({
        email: "age@example.com",
        password: "MotDePasse123!",
        first_name: "Nouveau",
        last_name: "Compte",
        birth_date,
      } as any);

    it("refuse l'inscription d'un mineur, sans rien enregistrer", async () => {
      await expect(registerBornOn(yearsAgo(17))).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("accepte une personne qui a exactement l'âge minimum", async () => {
      await expect(registerBornOn(yearsAgo(18))).resolves.toBeDefined();
    });

    it("jamais une valeur figée dans le code : suit minimum_signup_age", async () => {
      platformConfig.get.mockResolvedValue({ password_min_length: 12, minimum_signup_age: 21 });
      await expect(registerBornOn(yearsAgo(19))).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("rejette une date de naissance dans le futur", async () => {
      await expect(
        service.register({
          email: "futur@example.com",
          password: "MotDePasse123!",
          first_name: "Nouveau",
          last_name: "Compte",
          birth_date: "2999-01-01",
        } as any),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("rejette au changement un mot de passe contenant l'année de naissance", async () => {
      const oldHash = await bcrypt.hash("ancien-mdp", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        first_name: "Jean",
        last_name: "Dupont",
        birth_date: "1998-05-12",
        password_hash: oldHash,
      });

      await expect(
        service.changePassword("user-1", {
          current_password: "ancien-mdp",
          new_password: "Soleil-Levant-1998",
        }),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("expose les règles d'inscription configurées au frontend", async () => {
      platformConfig.get.mockResolvedValue({ password_min_length: 14, minimum_signup_age: 21 });
      await expect(service.getRegistrationPolicy()).resolves.toEqual({
        password_min_length: 14,
        minimum_age: 21,
      });
    });

    it("rejette à la réinitialisation un mot de passe contenant le prénom", async () => {
      redis.get.mockResolvedValue("user-1");
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, first_name: "Éloïse", last_name: "Martin" });

      await expect(
        service.resetPassword({ token: "tok", new_password: "Eloise-2026-Secret!" }),
      ).rejects.toThrow(RpcException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("findByEmail", () => {
    it("retrouve un compte sans tenir compte de la casse, sans le mot de passe", async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...baseUser, password_hash: "secret-hash" }),
      };
      repo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.findByEmail("  Marie@Example.com ");

      expect(qb.where).toHaveBeenCalledWith("LOWER(u.email) = LOWER(:email)", { email: "Marie@Example.com" });
      expect(result).not.toHaveProperty("password_hash");
    });

    it("renvoie null pour un email sans compte", async () => {
      repo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findByEmail("inconnu@example.com")).resolves.toBeNull();
    });
  });

  describe("getUsersByIds", () => {
    it("résout plusieurs comptes en un seul aller-retour, sans le mot de passe (ex. newsletter)", async () => {
      repo.findBy.mockResolvedValue([
        { ...baseUser, id: "user-1", password_hash: "secret-hash" },
        { ...baseUser, id: "user-2", email: "autre@example.com", password_hash: "secret-hash" },
      ]);

      const result = await service.getUsersByIds([
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ]);

      expect(result).toHaveLength(2);
      expect(result.every((u) => !("password_hash" in u))).toBe(true);
    });

    it("ignore un identifiant mal formé au lieu de faire échouer toute la requête", async () => {
      repo.findBy.mockResolvedValue([]);

      await service.getUsersByIds(["identifiant-invalide", "11111111-1111-4111-8111-111111111111"]);
      expect(repo.findBy).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(repo.findBy.mock.calls[0][0])).not.toContain("identifiant-invalide");

      repo.findBy.mockClear();
      await expect(service.getUsersByIds(["identifiant-invalide"])).resolves.toEqual([]);
      expect(repo.findBy).not.toHaveBeenCalled();
    });

    it("ne fait aucun appel base pour une liste vide", async () => {
      const result = await service.getUsersByIds([]);

      expect(result).toEqual([]);
      expect(repo.findBy).not.toHaveBeenCalled();
    });
  });

  describe("inviteAgent — agent de contrôle invité par email", () => {
    const invite = {
      email: " Agent.Porte@Example.com ",
      first_name: "Awa",
      last_name: "Diallo",
      event_name: "Concert",
      event_date: "samedi 24 octobre 2026",
      organizer_name: "Les Nuits",
    };
    const notif = () => (service as unknown as { notifClient: { emit: jest.Mock } }).notifClient;

    it("adresse inconnue : crée un compte AGENT sans mot de passe et envoie le lien pour le choisir", async () => {
      queryBuilder.getOne.mockResolvedValue(null);
      repo.create.mockImplementation((u: object) => u);
      repo.save.mockImplementation((u: object) => Promise.resolve({ id: "agent-1", ...u }));
      platformConfig.get.mockResolvedValue({ agent_invitation_hours: 72 });

      await expect(service.inviteAgent(invite)).resolves.toEqual({ user_id: "agent-1", created: true });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "agent.porte@example.com", role: UserRole.AGENT, password_hash: null, is_email_verified: false }),
      );
      expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^reset_password:/), "agent-1", "EX", 72 * 3600);
      expect(notif().emit).toHaveBeenCalledWith(
        "notification.agent_invitation",
        expect.objectContaining({ token: expect.any(String), eventName: "Concert" }),
      );
    });

    it("compte agent actif : affecté et prévenu, sans nouveau lien", async () => {
      queryBuilder.getOne.mockResolvedValue({
        id: "agent-2", email: "agent.porte@example.com", first_name: "Awa", role: UserRole.AGENT, password_hash: "hash",
      });

      await expect(service.inviteAgent(invite)).resolves.toEqual({ user_id: "agent-2", created: false });
      expect(repo.save).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
      const [, sent] = notif().emit.mock.calls.find(([pattern]) => pattern === "notification.agent_invitation")!;
      expect(sent).not.toHaveProperty("token");
    });

    it("compte agent jamais activé (lien expiré) : nouveau lien envoyé", async () => {
      queryBuilder.getOne.mockResolvedValue({ id: "agent-3", email: "agent.porte@example.com", first_name: "Awa", role: UserRole.AGENT, password_hash: null });
      platformConfig.get.mockResolvedValue({ agent_invitation_hours: 72 });

      await expect(service.inviteAgent(invite)).resolves.toEqual({ user_id: "agent-3", created: false });
      expect(repo.save).not.toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^reset_password:/), "agent-3", "EX", 72 * 3600);
      const [, sent] = notif().emit.mock.calls.find(([pattern]) => pattern === "notification.agent_invitation")!;
      expect(sent).toHaveProperty("token");
    });

    it("refuse l'adresse d'un compte acheteur ou organisateur", async () => {
      queryBuilder.getOne.mockResolvedValue({ id: "buyer-1", role: UserRole.BUYER });
      await expect(service.inviteAgent(invite)).rejects.toMatchObject({ error: { statusCode: 409 } });
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe("resendAgentInvitation — renvoi du lien d'activation", () => {
    const resend = { user_id: "agent-3", event_name: "Concert", event_date: "samedi 24 octobre 2026", organizer_name: "Les Nuits" };
    const notif = () => (service as unknown as { notifClient: { emit: jest.Mock } }).notifClient;

    it("agent pas encore activé : nouveau lien, valable agent_invitation_hours", async () => {
      queryBuilder.getOne.mockResolvedValue({ id: "agent-3", email: "a@x.fr", first_name: "Awa", role: UserRole.AGENT, password_hash: null });
      platformConfig.get.mockResolvedValue({ agent_invitation_hours: 48 });

      await expect(service.resendAgentInvitation(resend)).resolves.toEqual({ success: true });
      expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^reset_password:/), "agent-3", "EX", 48 * 3600);
      expect(notif().emit).toHaveBeenCalledWith(
        "notification.agent_invitation",
        expect.objectContaining({ token: expect.any(String), validHours: 48, eventName: "Concert" }),
      );
    });

    it("compte déjà activé : refusé, aucun lien", async () => {
      queryBuilder.getOne.mockResolvedValue({ id: "agent-3", role: UserRole.AGENT, password_hash: "hash" });
      await expect(service.resendAgentInvitation(resend)).rejects.toMatchObject({ error: { statusCode: 409 } });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it("compte d'un autre rôle : introuvable", async () => {
      queryBuilder.getOne.mockResolvedValue({ id: "agent-3", role: UserRole.BUYER, password_hash: null });
      await expect(service.resendAgentInvitation(resend)).rejects.toMatchObject({ error: { statusCode: 404 } });
    });
  });

  describe("verifyPassword — confirmation d'une action sensible", () => {
    it('mot de passe correct : confirmé', async () => {
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: await bcrypt.hash("Secret123!", 4) });
      await expect(service.verifyPassword("user-1", "Secret123!")).resolves.toEqual({ valid: true, has_password: true });
    });

    it("mot de passe incorrect : refusé et compté pour le verrouillage", async () => {
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: await bcrypt.hash("Secret123!", 4), failed_login_attempts: 0 });
      await expect(service.verifyPassword("user-1", "mauvais")).rejects.toMatchObject({ error: { statusCode: 400 } });
    });

    it("mot de passe vide : demandé, sans compter d'échec", async () => {
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: "hash" });
      await expect(service.verifyPassword("user-1", "")).rejects.toMatchObject({ error: { statusCode: 400 } });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("compte sans mot de passe (connexion Google/Facebook) : signalé à l'appelant", async () => {
      queryBuilder.getOne.mockResolvedValue({ ...baseUser, password_hash: null });
      await expect(service.verifyPassword("user-1", "x")).resolves.toEqual({ valid: true, has_password: false });
    });
  });
});
