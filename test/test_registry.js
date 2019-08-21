const helpers = require('./helpers');
const constants = helpers.constants;
const assertFailure = helpers.assertFailure;
const PackageRegistry = artifacts.require("PackageRegistry");

contract('PackageRegistry', function(accounts) {
  let packageRegistry;

  const releaseInfoA = ['test-r', '1.2.3.t.u', 'ipfs://some-ipfs-uri'];
  const releaseInfoB = ['test-r', '2.3.4.v.y', 'ipfs://some-other-ipfs-uri'];
  const releaseInfoC = ['test-r', '3.4.5.w.q', 'ipfs://yet-another-ipfs-uri'];
  const packageIdA = '0xc4cf7a4b913721e342e4482e22bb88e365c91a339f8bd16f610009b083cc1f9a'
  const releaseIdA = '0x09e922d900d5202de4dd159c3035a4325613f9f52245e371a0dc128f6666f119'
  const releaseIdB = '0x1d87dce16481deba210017b90d960778c886c5f1ab77488302df9b09c90effe4'
  const releaseIdC = '0x1f011fb8ea428670070fd2c145f07c02014ff1757e6749f2c05758f444cb9ce2'

  async function assertRelease(
    name,
    version,
    manifestUri,
    receipt,
    releaseData,
  ) {
    const packageId = await packageRegistry.generatePackageId(name)
    const releaseId = await packageRegistry.generateReleaseId(name, version)

    const exists = await packageRegistry.releaseExists(name, version);
    const generatedId = await packageRegistry.generateReleaseId(name, version);
    const getId = await packageRegistry.getReleaseId(name, version);

    assert(generatedId === releaseId);
    assert(getId === releaseId);
    assert(exists);

	// Test events are emitted
    assert(receipt.logs[0].event === "VersionRelease")
    assert(receipt.logs[0].args.packageName === name)
    assert(receipt.logs[0].args.version === version)
    assert(receipt.logs[0].args.manifestURI === manifestUri)

    const ids = await packageRegistry.getAllReleaseIds(name, 0, 100);
    assert(ids.releaseIds.includes(releaseId));
    assert(releaseData.packageName === name);
    assert(releaseData.version === version);
    assert(releaseData.manifestURI === manifestUri);
  }

  describe('Initialization', function() {
    beforeEach(async function() {
      packageRegistry = await PackageRegistry.new();
    })

    it('should release when initialized correctly', async function() {
      let owner = await packageRegistry.owner()
      assert(owner === accounts[0])

      await packageRegistry.release(...releaseInfoA)
      assert(await packageRegistry.packageExists('test-r') === true);
    });
  });

  describe('Methods', function() {
    beforeEach(async () => {
      packageRegistry = await PackageRegistry.new();
      nameHash = await packageRegistry.generatePackageId('test');
    })

    describe('packages', function() {
      it('should retrieve all packages ids / package names', async function() {
        nameHash = await packageRegistry.generatePackageId('test-r');

        const packageIdA = await packageRegistry.generatePackageId(releaseInfoA[0]);
        const packageIdB = await packageRegistry.generatePackageId(releaseInfoB[0]);

        await packageRegistry.release(...releaseInfoA)
        await packageRegistry.release(...releaseInfoB)

        const ids = await packageRegistry.getAllPackageIds(0, 100);

        assert(ids.packageIds.includes(packageIdA));
        assert(ids.packageIds.includes(packageIdB));

        const nameA = await packageRegistry.getPackageName(packageIdA);
        const nameB = await packageRegistry.getPackageName(packageIdB);

        assert(nameA === releaseInfoA[0]);
        assert(nameB === releaseInfoB[0]);
      });
    });

    describe('releases', function() {
      it('should retrieve release by release id', async function() {
        const releaseIdA = await packageRegistry.generateReleaseId(releaseInfoA[0], releaseInfoA[1])
        const releaseIdB = await packageRegistry.generateReleaseId(releaseInfoB[0], releaseInfoB[1])

        const responseA = await packageRegistry.release(...releaseInfoA)
        const responseB = await packageRegistry.release(...releaseInfoB)

        const releaseDataA = await packageRegistry.getReleaseData(releaseIdA)
        const releaseDataB = await packageRegistry.getReleaseData(releaseIdB)

        await assertRelease(...releaseInfoA, responseA, releaseDataA)
        await assertRelease(...releaseInfoB, responseB, releaseDataB)
      });

      it('should retrieve a list of all release hashes', async function() {
        const releaseInfoA = ['test-a', '1.2.3.a.b', 'ipfs://a']
        const releaseInfoB = ['test-b', '2.3.4.c.d', 'ipfs://b']
        const releaseInfoC = ['test-c', '3.4.5.e.f', 'ipfs://c']
        const releaseInfoD = ['test-c', '3.4.6.e.f', 'ipfs://d']
        const releaseInfoE = ['test-b', '2.4.5.c.d', 'ipfs://e']
        const releaseInfoF = ['test-c', '3.5.5.e.f', 'ipfs://f']

        await packageRegistry.release(...releaseInfoA)
        await packageRegistry.release(...releaseInfoB)
        await packageRegistry.release(...releaseInfoC)
        await packageRegistry.release(...releaseInfoD)
        await packageRegistry.release(...releaseInfoE)
        await packageRegistry.release(...releaseInfoF)

        const numPackageIds = await packageRegistry.numPackageIds();
        const numReleasesA = await packageRegistry.numReleaseIds('test-a');
        const numReleasesB = await packageRegistry.numReleaseIds('test-b');
        const numReleasesC = await packageRegistry.numReleaseIds('test-c');

        assert.equal(numPackageIds, 3)
        assert.equal(numReleasesA, 1)
        assert.equal(numReleasesB, 2)
        assert.equal(numReleasesC, 3)
      });

      it('returns proper values for nonexistent numPackageIds, numReleaseIds', async () => {
        const packageCount = await packageRegistry.packageCount();
        const releaseCount = await packageRegistry.releaseCount();

        const numNonExistentPackageIds = await packageRegistry.numPackageIds();

        assert.equal(packageCount, 0)
        assert.equal(releaseCount, 0)
        assert.equal(numNonExistentPackageIds, 0)

        await assertFailure(
          packageRegistry.numReleaseIds(releaseInfoA[0]),
          'package-does-not-exist'
        )
      });
    });

    describe('getAllReleaseIds', function() {
      beforeEach(async function() {
        await packageRegistry.release(...releaseInfoA)
        await packageRegistry.release(...releaseInfoB)
        await packageRegistry.release(...releaseInfoC)
      });

      it('returns proper values for valid numPackageIds, numReleaseIds', async () => {
        const numPackageIds = await packageRegistry.numPackageIds();
        const numReleaseIds = await packageRegistry.numReleaseIds('test-r');

        assert.equal(numPackageIds, 1);
        assert.equal(numReleaseIds, 3);
      });

      it('reverts for a non-existent release', async () => {
        await assertFailure(
          packageRegistry.getAllReleaseIds('test-none', 0, 20),
          'package-does-not-exist'
        )
      });

      it('cannot update an existing release', async () => {
        await assertFailure(
          packageRegistry.release(...releaseInfoA),
          'release-already-exists'
        )
      });

      it('returns ([],pointer) when pointer equals # of releases', async () => {
        const limit = 20;
        const totalCount = 3;
        const result = await packageRegistry.getAllReleaseIds('test-r', totalCount, limit);

        assert(Array.isArray(result.releaseIds));
        assert(result.releaseIds.length === 0);
        assert(result.pointer.toNumber() === totalCount)
      });

      it('returns releases and pointer with non-zero offset', async () => {
        const limit = 20;
        const totalCount = 1;
        const result = await packageRegistry.getAllReleaseIds('test-r', totalCount, limit);

        assert(Array.isArray(result.releaseIds));
        assert(result.releaseIds.length === 2);
        assert(result.pointer.toNumber() === 3)
      });

      it('returns ([],0) when limit param is zero', async () => {
        const result = await packageRegistry.getAllReleaseIds('test-r', 0, 0);

        assert(Array.isArray(result.releaseIds));
        assert(result.releaseIds.length === 0);
        assert(result.pointer.toNumber() === 0)
      });

      it('returns ([allReleaseIds], limit) when limit is greater than # of releases', async function() {
        const limit = 4;
        const result = await packageRegistry.getAllReleaseIds('test-r', 0, limit);

        assert(result.pointer.toNumber() === 3);
        assert(result.releaseIds.length === 3);
      });

      it('returns releases and pointer when limit is < # of releases', async function() {
        const numReleases = await packageRegistry.numReleaseIds('test-r');
        assert.equal(numReleases, 3);

        const limit = 2;
        const resultA = await packageRegistry.getAllReleaseIds('test-r', 0, limit);

        // Initial results (2)
        assert(resultA.releaseIds.length === limit);
        assert(resultA.pointer.toNumber() === limit);

        const resultB = await packageRegistry.getAllReleaseIds('test-r', resultA.pointer, limit);

        // Remaining results (1)
        assert(resultB.releaseIds.length === numReleases - limit);
        assert.equal(resultB.pointer.toNumber(), numReleases);

        const resultC = await packageRegistry.getAllReleaseIds('test-r', resultB.pointer, limit);

        // Empty results, terminal index
        assert(resultC.releaseIds.length === 0);
        assert.equal(resultC.pointer.toNumber(), numReleases);

        let allIds = resultA.releaseIds.concat(resultB.releaseIds);

        assert.equal(allIds.length, numReleases);
      });
    });

    describe('generate release id', function() {
      it('generates release ids for existing packages', async function() {
        const actualReleaseIdA = await packageRegistry.generateReleaseId(releaseInfoA[0], releaseInfoA[1]);
        const actualReleaseIdB = await packageRegistry.generateReleaseId(releaseInfoB[0], releaseInfoB[1]);

        assert.equal(actualReleaseIdA, releaseIdA)
        assert.equal(actualReleaseIdB, releaseIdB)
      });

      it('generates release ids for unreleased packages', async function() {
        const actualReleaseId = await packageRegistry.generateReleaseId('text-xx', '1.0.0');
        assert(actualReleaseId.startsWith("0x"))
        assert.equal(actualReleaseId.length, 66)
      });
    });

    describe("get package name", function() {
      it('reverts if package does not exist', async function() {
        await assertFailure(
          packageRegistry.getPackageName(web3.utils.fromAscii("xxx")),
          'package-does-not-exist'
        )
      });
    });

    describe('get release id', function() {
      ("reverts if release does not exist", async function() {
        await assertFailure(
          packageRegistry.getReleaseId('nonexistent', 'x.x.x'),
          'release-does-not-exist'
        )
      });
    });

    describe('validation', function() {
      it("reverts with empty package name", async function() {
        await assertFailure(
          packageRegistry.release('', 'x.x.x', 'ipfs://uri'),
          'invalid-package-name'
        )
      });

      it("reverts with single-char package name", async function() {
        await assertFailure(
          packageRegistry.release('x', 'x.x.x', 'ipfs://uri'),
          'invalid-package-name'
        )
      });

      it("reverts with too long package name", async function() {
        await assertFailure(
          packageRegistry.release('x'.repeat(256), 'x.x.x', 'ipfs://uri'),
          'invalid-package-name'
        )
      });

      it("reverts with empty version", async function() {
        await assertFailure(
          packageRegistry.release('pkg', '', 'ipfs://uri'),
          'invalid-string-identifier'
        )
      });

      it("reverts with empty uri", async function() {
        await assertFailure(
          packageRegistry.release('pkg', 'x.x.x', ''),
          'invalid-string-identifier'
        )
      });
    });

    describe('ownership', function() {
      const info = ['test-a', '1.2.3', 'ipfs://some-ipfs-uri'];
      const owner = accounts[0];
      const newOwner = accounts[1];
      const notOwner = accounts[2];
      const name = info[0];

      beforeEach(async () => {
        assert(await packageRegistry.packageExists(name) === false);
      })

      it('only the current owner can release packages', async function() {
        const currentOwner = await packageRegistry.owner();
        assert(currentOwner === owner);

        await packageRegistry.release(...info, {
          from: owner
        });
        await assertFailure(
          packageRegistry.release('test-b', 'x.x.x', 'ipfs://uri', {
            from: notOwner
          }),
          'caller is not the owner'
        )

        await packageRegistry.transferOwnership(newOwner);
        const updatedOwner = await packageRegistry.owner();
        assert(updatedOwner === newOwner);
        await assertFailure(
          packageRegistry.release('test-b', 'x.x.x', 'ipfs://uri', {
            from: owner
          }),
          'caller is not the owner'
        )
      });
    });
  });
});
