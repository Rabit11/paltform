package com.zgsf.srpm.repo;

import com.zgsf.srpm.domain.PersonDirectory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PersonDirectoryRepository extends JpaRepository<PersonDirectory, String> {
    List<PersonDirectory> findByOnJobTrueOrderByEmpNoAsc();
}
