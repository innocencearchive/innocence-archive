-- CreateTable
CREATE TABLE "individual_groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IndividualGroupMembership" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_IndividualGroupMembership_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "individual_groups_name_key" ON "individual_groups"("name");

-- CreateIndex
CREATE INDEX "_IndividualGroupMembership_B_index" ON "_IndividualGroupMembership"("B");

-- AddForeignKey
ALTER TABLE "_IndividualGroupMembership" ADD CONSTRAINT "_IndividualGroupMembership_A_fkey" FOREIGN KEY ("A") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IndividualGroupMembership" ADD CONSTRAINT "_IndividualGroupMembership_B_fkey" FOREIGN KEY ("B") REFERENCES "individual_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
