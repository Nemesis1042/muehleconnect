{
  description = "MühleConnect development flake";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.python312
            pkgs.python312Packages.fastapi
            pkgs.python312Packages.uvicorn
            pkgs.python312Packages.sqlalchemy
            pkgs.python312Packages.psycopg2
            pkgs.postgresql
            pkgs.redis
            pkgs.flutter
            pkgs.docker
          ];
          shellHook = ''
            echo "Dev environment ready: FastAPI + Flutter"
          '';
        };
      });
}
