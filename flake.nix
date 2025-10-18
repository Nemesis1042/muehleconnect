{
  description = "MühleConnect development flake";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        pythonEnv = pkgs.python312.withPackages (
          ps: with ps; [
            fastapi
            uvicorn
            sqlalchemy
            psycopg2
            redis
            python-dotenv
            pydantic-settings
            passlib
            python-jose
            alembic
          ]
        );
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pythonEnv
            pkgs.postgresql
            pkgs.redis
            pkgs.flutter
            pkgs.docker
            pkgs.tree
          ];
          shellHook = ''
            echo "Dev environment ready: FastAPI + Flutter + Redis"
          '';
        };
      }
    );
}
